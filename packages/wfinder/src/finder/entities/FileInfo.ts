import { getSwitchedDbConfig, switchDb } from "./../db";
import { DbIncluded } from "./DbIncluded";
import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  RemoveOptions,
  Repository,
} from "typeorm";
import * as path from "path";
import { EvFileInfoChange, EvLog } from "../events/events";
import { sumBy } from "lodash";
import * as fs from "fs";
import { interactYield } from "../../tools/tool";
import { BehaviorSubject } from "rxjs";

export enum FileType {
  file,
  folder,
}

export const IndexTableName = "fileindex";

@Entity()
export class FileInfo extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Id of parent directory, value -1 means no parent */
  @Column()
  parentId: number;

  @Column({ type: "text" })
  private name: string;

  public getName() {
    return restoreText(this.name);
  }

  @Column({ type: "float" })
  size: number;

  @Column()
  type: FileType;

  @Column({ default: 0 })
  ctime!: Date;

  dbRoot = getSwitchedDbConfig().finderRoot;

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
    EvFileInfoChange.next();
    return res;
  }

  async remove(options?: RemoveOptions) {
    await FileInfo.removeNameIndexs([this]);
    const res = await super.remove(options);
    EvFileInfoChange.next();
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
    doQuery: (rep: Repository<FileInfo>) => Promise<T[]>
  ) {
    let res: T[] = await doQuery(this.getRepository());
    const includedDbs = await DbIncluded.find();
    const config = getSwitchedDbConfig();
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

  static async countByMatchName(keywords: string[], onlyCurrentDb = false) {
    const query = (rep: Repository<FileInfo>) =>
      rep.query(
        `select count(1) as count from ${IndexTableName} where name match ?`,
        [processQueryText(keywords.join(" "))]
      );
    const res = await (onlyCurrentDb
      ? query(this.getRepository())
      : this.queryAllDbIncluded(query));
    return sumBy(res, "count");
  }

  static async findByMatchName(keywords: string[], take = 100, skip = 0) {
    const end = take + skip;
    let pos = 0;
    return await this.queryAllDbIncluded(async (rep) => {
      if (pos > end) return [];
      const count = await this.countByMatchName(keywords, true);
      const mSkip = Math.max(0, skip - pos);
      const mEnd = Math.min(end - pos, count);
      const mTake = Math.max(0, mEnd - mSkip);
      pos += count;
      if (!mTake) return [];
      return await rep
        .query(
          `select rowid from ${IndexTableName} where name match ? limit ?,?`,
          [processQueryText(keywords.join(" ")), mSkip, mTake]
        )
        .then((ids) => {
          return this.findByIds(ids.map((v: any) => v.rowid));
        });
    });
  }

  static async removeNameIndexs(fileInfos: FileInfo[]) {
    if (!fileInfos.length) return;
    await FileInfo.getRepository().query(
      `delete from ${IndexTableName} where rowid in (${fileInfos
        .map((v) => v.id)
        .join(",")})`
    );
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
      (await this.find({ where: { parentId, name } }))[0] ||
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
  ];
  return (text: string, separator = "/") => {
    const replace = `$1${separator}$2`;
    return regs.reduce((res, reg) => res.replace(reg, replace), text);
  };
})();

const processQueryText = (text: string) => processText(text, " ");

const restoreText = (text: string) => text.replace(/\//g, "");
