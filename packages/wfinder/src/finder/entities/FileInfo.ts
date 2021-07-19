import { DEFAULT_QUERY_LIMIT } from "./../common";
import { BaseDbInfoEntity } from "./BaseDbInfoEntity";
import { getConfig, switchDb } from "./../db";
import { DbIncluded } from "./DbIncluded";
import {
  BaseEntity,
  Column,
  Entity,
  In,
  PrimaryGeneratedColumn,
  RemoveOptions,
  Repository,
} from "typeorm";
import * as path from "path";
import { EvLog } from "../events/events";
import { sumBy } from "lodash";
import * as fs from "fs";
import { interactYield } from "../../tools/tool";
import { BehaviorSubject } from "rxjs";
import { FileType } from "../types";

export const IndexTableName = "fileindex";

@Entity()
export class FileInfo extends BaseDbInfoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Id of parent directory, value -1 means no parent */
  @Column()
  parentId: number;

  @Column({ type: "text" })
  private name: string;

  getName() {
    return restoreText(this.name);
  }

  @Column({ type: "float" })
  size: number;

  @Column()
  type: FileType;

  @Column({ default: 0 })
  ctime!: Date;

  constructor(
    name: string,
    type: FileType,
    ctime: Date,
    parentId = -1,
    size = 0
  ) {
    super();
    this.name = processText(name || "");
    this.type = type;
    this.ctime = ctime;
    this.parentId = parentId;
    this.size = size;
  }

  async save() {
    const res = await super.save();
    await FileInfo.getRepository().query(
      `insert into ${IndexTableName}(rowid, name) values(${this.id},?)`,
      [this.name]
    );
    return res;
  }

  async remove(options?: RemoveOptions) {
    await FileInfo.removeNameIndexs([this]);
    const res = await super.remove(options);
    return res;
  }

  async getPath() {
    let filePath = this.name;
    let info: FileInfo | undefined = this;
    while (true) {
      info = await FileInfo.findOne(info.parentId);
      if (info) filePath = path.join(info.name, filePath);
      else break;
    }
    return filePath;
  }

  private static async queryAllDbIncluded<T>(
    doQuery: (handle: typeof FileInfo) => Promise<T[]>
  ) {
    let res: T[] = await doQuery(this);
    const includedDbs = await DbIncluded.find();
    const config = getConfig();
    for (const db of includedDbs) {
      const finderRoot = path.join(config.finderRoot, db.path);
      try {
        const dbPath = path.join(finderRoot, db.dbName);
        if (!fs.existsSync(dbPath)) {
          EvLog(`It's time to rescan, sub database file not exist: ${dbPath}.`);
        } else
          await switchDb(
            {
              dbName: db.dbName,
              finderRoot,
              dbPath,
              readOnly: true,
              isSubDb: true,
            },
            async () => {
              res = res.concat(await FileInfo.queryAllDbIncluded(doQuery));
            }
          );
      } catch (e) {
        console.error("Query sub database failed: ", finderRoot, e);
      }
    }
    return res;
  }

  static async countByMatchName(
    keywords: string[],
    onlyCurrentDb = false,
    queryLimit = DEFAULT_QUERY_LIMIT
  ) {
    const query = (rep: typeof FileInfo) =>
      rep.query(
        `select count(1) as count from ${IndexTableName} where name match ?`,
        [processQueryText(keywords.join(" "))]
      );
    const res: any[] = await (onlyCurrentDb
      ? query(this)
      : this.queryAllDbIncluded(query));
    let rTotal = 0;
    if (!getConfig().isSubDb) {
      const remoteQuery = this.callRemoteStaticMethod(
        "countByMatchName",
        [keywords, onlyCurrentDb],
        queryLimit
      );
      let rRes = await remoteQuery.next();
      while (!rRes.done) {
        const { result } = rRes.value.rRes;
        if (typeof result === "number") rTotal += result;
        else {
          EvLog(
            `Error: remote call countByMatchName return invalid value: `,
            result
          );
        }
        rRes = await remoteQuery.next();
      }
    }
    return sumBy(res, "count") + rTotal;
  }

  static async findByMatchName(
    keywords: string[],
    take = 100,
    skip = 0,
    queryLimit = DEFAULT_QUERY_LIMIT
  ) {
    const end = take + skip;
    let pos = 0;
    let res: FileInfo[] = await this.queryAllDbIncluded(async (handle) => {
      if (pos > end) return [];
      const count = await handle.countByMatchName(keywords, true);
      const mSkip = Math.max(0, skip - pos);
      const mEnd = Math.min(end - pos, count);
      const mTake = Math.max(0, mEnd - mSkip);
      pos += count;
      if (!mTake) return [];
      return await handle
        .getRepository()
        .query(
          `select rowid from ${IndexTableName} where name match ? limit ?,?`,
          [processQueryText(keywords.join(" ")), mSkip, mTake]
        )
        .then((ids) => {
          return this.findByIds(ids.map((v: any) => v.rowid));
        });
    });
    if (pos < end && !getConfig().isSubDb) {
      const remoteQuery = this.callRemoteStaticMethod(
        "findByMatchName",
        [keywords, take, skip],
        queryLimit
      );
      let rRes = await remoteQuery.next();
      while (!rRes.done) {
        const value = rRes.value;
        if (value !== undefined && value.rRes.result?.constructor === Array) {
          // @ts-ignore
          const fileInfos: FileInfo[] = rRes.value.rRes.result;
          fileInfos.forEach(
            (v) =>
              (v.dbInfo.remoteUrls = [
                value.url,
                ...(v.dbInfo.remoteUrls || []),
              ])
          );
          res = res.concat(fileInfos);
        }
        rRes = await remoteQuery.next();
      }
    }
    return res;
  }

  static async removeNameIndexs(fileInfos: FileInfo[]) {
    if (!fileInfos.length) return;
    await FileInfo.getRepository().query(
      `delete from ${IndexTableName} where rowid in (${fileInfos
        .map((v) => v.id)
        .join(",")})`
    );
  }

  /**
   * Remove children.
   * @param childrenNames if not given, all children will be removed.
   * @returns
   */
  static async removeChildren(
    id: number,
    childrenNames?: string[],
    brake?: BehaviorSubject<boolean>,
    removeSelf = false
  ) {
    let skip = 0;
    const take = 100;
    let toRemoveIds: number[] = [];
    while (!brake?.value) {
      const children = await this.find({
        where: {
          parentId: id,
          ...(childrenNames
            ? { name: In(childrenNames.map((v) => processText(v))) }
            : {}),
        },
        skip,
        take,
      });
      skip += take;
      if (!children.length) break;
      const toRemove: FileInfo[] = [];
      for (const child of children) {
        await this.removeChildren(child.id);
        toRemove.push(child);
      }
      await this.removeNameIndexs(toRemove);
      toRemoveIds = toRemoveIds.concat(toRemove.map((v) => v.id));
      await interactYield();
    }
    if (brake?.value) return;
    if (removeSelf) toRemoveIds.concat(id);
    if (toRemoveIds.length) await this.delete(toRemoveIds);
  }

  static async removeUnexistChildren(
    id: number,
    existChildNames: string[],
    brake?: BehaviorSubject<boolean>
  ) {
    let skip = 0;
    const take = 100;
    const existSet = new Set(existChildNames);
    let toRemoveIds: number[] = [];
    while (!brake?.value) {
      const children = await this.find({ where: { parentId: id }, skip, take });
      skip += take;
      if (!children.length) break;
      const toRemove: FileInfo[] = [];
      for (const child of children) {
        if (!existSet.has(child.name)) {
          await this.removeUnexistChildren(child.id, []);
          toRemove.push(child);
        }
      }
      await this.removeNameIndexs(toRemove);
      toRemoveIds = toRemoveIds.concat(toRemove.map((v) => v.id));
      await interactYield();
    }
    if (!brake?.value && toRemoveIds.length) await this.delete(toRemoveIds);
  }

  static async getOrInsert(
    name: string,
    type: FileType,
    ctime: Date,
    parentId = -1,
    size = 0
  ) {
    return (
      (await this.find({ where: { parentId, name: processText(name) } }))[0] ||
      (await new this(name, type, ctime, parentId, size).save())
    );
  }
}

/** TODO: support searching for special characters like ".[]" */
const processText = (() => {
  const regs = [
    /([^\d/ ])(\d+)/g,
    /(\d+)([^\d/ ])/g,
    /([a-z])([A-Z])/g,
    /([A-Z]{2,})([a-z])/g,
    /([^/ ])([^\x00-\xff])/g,
    /([^\x00-\xff])([^/ ])/g,
    /([^/ ])([_])/g,
    /([_])([^/ ])/g,
  ];
  return (text: string, separator = "/") => {
    const replace = `$1${separator}$2`;
    return regs.reduce((res, reg) => res.replace(reg, replace), text);
  };
})();

const processQueryText = (text: string) => processText(text, " ");

const restoreText = (text: string) => text.replace(/\//g, "");
