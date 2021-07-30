import { EvLogError } from "./../events/events";
import { createFtsTable, getConnection } from "../db";
import { DEFAULT_QUERY_LIMIT } from "./../common";
import { BaseDbInfoEntity } from "./BaseDbInfoEntity";
import { getConfig, switchDb } from "./../db";
import { DbIncluded } from "./DbIncluded";
import {
  BaseEntity,
  Column,
  Entity,
  FindConditions,
  FindManyOptions,
  In,
  Index,
  PrimaryGeneratedColumn,
  RemoveOptions,
  Repository,
} from "typeorm";
import * as path from "path";
import { EvLog } from "../events/events";
import { last, sum, sumBy } from "lodash";
import * as fs from "fs";
import { interactYield } from "../../tools/tool";
import { BehaviorSubject } from "rxjs";
import { FileType } from "../types";
import { splitPath } from "../../tools/pathTool";
import hashString from "string-hash";

export const IndexTableName = "fileindex";

@Entity()
export class FileInfo extends BaseDbInfoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Id of parent directory, value -1 means no parent */
  @Index()
  @Column()
  parentId: number;

  @Column({ type: "text" })
  private name: string;

  @Index()
  @Column({ default: 0 })
  nameHash: number;

  getName() {
    return restoreText(this.name);
  }

  @Column({ type: "float" })
  size: number;

  @Column()
  type: FileType;

  @Column({ default: 0 })
  ctime!: Date;

  absPath = "";

  constructor(
    name: string,
    type: FileType,
    ctime: Date,
    parentId = -1,
    size = 0,
    nameHash?: number,
    nameProcessed = false
  ) {
    super();
    this.name = nameProcessed ? name : processText(name || "");
    this.type = type;
    this.ctime = ctime;
    this.parentId = parentId;
    this.size = size;
    this.nameHash = nameHash || hashString(this.name);
  }

  public static processAndHashName(nameStr: string) {
    const name = processText(nameStr);
    return [name, hashString(name)] as [string, number];
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
    let filePath = this.getName();
    let info: FileInfo | undefined = this;
    while (true) {
      info = await FileInfo.findOne(info.parentId);
      if (info) filePath = path.join(info.getName(), filePath);
      else break;
    }
    return filePath;
  }

  static async removeAllIndexedData() {
    await this.queryAllDbIncluded(async (handle) => {
      await handle.clear().catch((e) => {
        console.error("Clear FileInfo table failed: ", e);
      });
      await handle
        .getRepository()
        .query(`drop table ${IndexTableName}`)
        .catch((e) => {
          console.error("Clear fts table failed: ", e);
        });
      await createFtsTable(await getConnection()).catch((e) => {
        console.error("Create fts table failed: ", e);
      });
      await DbIncluded.clear().catch((e) => {
        console.error("Clear DbIncluded table failed: ", e);
      });
      return [];
    }, false);
  }

  static async countAllSubDatabases() {
    const res = await this.queryAllDbIncluded((handle) =>
      handle.count().then((res) => [res])
    );
    return sum(res);
  }

  static async countByMatchName(
    keywords: string[],
    fullMatchStr?: string,
    regMatchStr?: string,
    onlyCurrentDb = false,
    queryLimit = DEFAULT_QUERY_LIMIT
  ) {
    if (!keywords.every((v) => v) && !fullMatchStr && !regMatchStr) return 0;
    const query = regMatchStr
      ? await (async () => {
          const { queryStr, queryParams } = await genComplexQuery(
            (indexTable) => `select ${indexTable ? "rowid" : "id"} as id `,
            keywords,
            fullMatchStr
          );
          return async (rep: typeof FileInfo) => {
            let ids = (await rep.query(queryStr, queryParams)).map(
              (v: any) => v.id
            );
            ids = await rep.regexpMatch(ids, regMatchStr);
            return [{ count: ids.length }];
          };
        })()
      : await (async () => {
          const { queryStr, queryParams } = await genComplexQuery(
            () => "select count(1) as count",
            keywords,
            fullMatchStr
          );
          return (rep: typeof FileInfo) => rep.query(queryStr, queryParams);
        })();
    const res: any[] = await (onlyCurrentDb
      ? query(this)
      : this.queryAllDbIncluded(query));
    let rTotal = 0;
    if (!getConfig().isSubDb) {
      const remoteQuery = this.callRemoteStaticMethod(
        "countByMatchName",
        [keywords, fullMatchStr, regMatchStr, onlyCurrentDb],
        queryLimit
      );
      let rRes = await remoteQuery.next();
      while (!rRes.done) {
        const { result } = rRes.value.rRes;
        if (typeof result === "number") rTotal += result;
        else {
          EvLogError(
            `Error: remote call countByMatchName return invalid value: `,
            result
          );
        }
        rRes = await remoteQuery.next();
      }
    }
    return sumBy(res, "count") + rTotal;
  }

  /** TODO: count total */
  static async findByMatchName(
    keywords: string[],
    fullMatchStr?: string,
    regMatchStr?: string,
    take = 100,
    skip = 0,
    queryLimit = DEFAULT_QUERY_LIMIT
  ) {
    if (!keywords.every((v) => v) && !fullMatchStr && !regMatchStr) return [];
    const end = take + skip;
    let pos = 0;
    let res: FileInfo[] = await this.queryAllDbIncluded(async (handle) => {
      if (pos > end) return [];
      let allIds: (number | string)[] = [];
      if (regMatchStr) {
        const { queryStr, queryParams } = await genComplexQuery(
          (indexTable) => `select ${indexTable ? "rowid" : "id"} as id `,
          keywords,
          fullMatchStr
        );
        allIds = (await handle.query(queryStr, queryParams)).map(
          (v: any) => v.id
        );
        allIds = await handle.regexpMatch(allIds, regMatchStr);
      }
      const count = regMatchStr
        ? allIds.length
        : await handle.countByMatchName(
            keywords,
            fullMatchStr,
            regMatchStr,
            true
          );
      const mSkip = Math.max(0, skip - pos);
      const mEnd = Math.min(end - pos, count);
      const mTake = Math.max(0, mEnd - mSkip);
      pos += count;
      if (!mTake) return [];
      if (regMatchStr) {
        allIds = await handle.regexpMatch(allIds, regMatchStr);
        allIds = allIds.slice(mSkip, mSkip + mTake);
      }
      let ids = allIds;
      if (!regMatchStr) {
        const { queryStr, queryParams } = await genComplexQuery(
          (indexTable) => `select ${indexTable ? "rowid" : "id"} as id `,
          keywords,
          fullMatchStr,
          mSkip,
          mTake
        );
        ids = (await handle.query(queryStr, queryParams)).map((v: any) => v.id);
      }
      return handle.findByIds(ids).then((infos) =>
        Promise.all(
          infos.map(async (v) => {
            v.absPath = await handle.getPath(v.id);
            return v;
          })
        )
      );
    });
    if (pos < end && !getConfig().isSubDb) {
      const remoteQuery = this.callRemoteStaticMethod(
        "findByMatchName",
        [keywords, fullMatchStr, regMatchStr, take, skip],
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

  static async regexpMatch(ids: (string | number)[], regStr: string) {
    const reg = new RegExp(regStr);
    const batchSize = 1000;
    let res: (string | number)[] = [];
    const tableName = (await getConnection()).getMetadata(this).tableName;
    while (ids.length) {
      const batch = ids.splice(-batchSize);
      const pairs: any[] = await this.query(
        `select id, name from ${tableName} where id in (${batch.join(",")})`
      );
      res = res.concat(
        pairs.filter((v) => reg.test(restoreText(v.name))).map((v) => v.id)
      );
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
    const existSet = new Set(existChildNames.map((v) => processText(v)));
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

  /**
   * Remove a given path and it's children.
   * @param path relative path to this finderRoot
   */
  static async removePath(path: string) {
    const pathSegs = splitPath(path);
    const fileInfos: FileInfo[] = [];
    for (const seg of pathSegs) {
      const parentId = last(fileInfos)?.id || -1;
      const fileInfo = await FileInfo.findByNameWhere(seg, { parentId });
      if (fileInfo.length > 1) {
        throw new Error(
          `Faile to remove path, more than one file have thesame name in folder(ID: ${parentId}): ${seg}`
        );
      } else if (!fileInfo.length) break;
      else {
        fileInfos.push(fileInfo[0]);
      }
    }
    const lastFile = last(fileInfos);
    if (!lastFile) return;
    if (restoreText(lastFile.name) === last(pathSegs)) {
      await FileInfo.removeChildren(lastFile.id);
    }
    fileInfos.reverse();
    for (const info of fileInfos) {
      if (!(await FileInfo.find({ where: { parentId: info.id } })).length) {
        await info.remove();
      }
    }
  }

  static async getPath(id: number, config = getConfig()) {
    return await switchDb(config, async () => {
      let fileInfo = await this.findOne(id);
      if (!fileInfo) throw new Error("FileInfo id not exist");
      const fileInfos = [fileInfo];
      while (fileInfo && fileInfo.parentId !== -1) {
        fileInfo = await this.findOne(fileInfo?.parentId);
        if (!fileInfo)
          throw new Error("Get FileInfo path failed, broken parentId chain.");
        fileInfos.push(fileInfo);
      }
      return fileInfos
        .reverse()
        .reduce(
          (res, v) => path.join(res, restoreText(v.name)),
          config.finderRoot
        );
    });
  }

  static async getOrInsert(
    name: string,
    type: FileType,
    ctime: Date,
    parentId = -1,
    size = 0
  ) {
    const [processedName, hash] = FileInfo.processAndHashName(name);
    return (
      (
        await this.find({
          where: { parentId, nameHash: hash, name: processedName },
        })
      )[0] ||
      (await new this(
        processedName,
        type,
        ctime,
        parentId,
        size,
        hash,
        true
      ).save())
    );
  }

  static findByNameWhere(name: string, where: FindConditions<FileInfo>) {
    const [processedName, nameHash] = this.processAndHashName(name);
    const mWhere = { ...(where || {}), nameHash, name: processedName };
    return FileInfo.find({ where: mWhere });
  }
}

const genComplexQuery = async (
  getSelectStr: (indexTable: boolean) => string,
  keywords: string[],
  fullMatchStr?: string,
  skip?: number,
  take?: number
) => {
  let queryStr = "";
  let queryParams: (string | number)[] = [];
  const tableName = (await getConnection()).getMetadata(FileInfo).tableName;
  if (keywords.every((v) => v) && !fullMatchStr) {
    queryStr = `${getSelectStr(
      true
    )} from ${IndexTableName} where name match ?`;
    queryParams = [processQueryText(keywords.join(" "))];
  }
  if (fullMatchStr) {
    queryStr = `${getSelectStr(false)} from ${tableName} where ${
      keywords.every((v) => v)
        ? `id in (select rowId from ${IndexTableName} where name match ?) and `
        : ""
    }${fullMatchStr ? `name like ? and ` : ""}`.replace(/and\s?$/, "");
    queryParams = [];
    if (keywords.every((v) => v))
      queryParams.push(processQueryText(keywords.join(" ")));
    if (fullMatchStr) queryParams.push(processText(`%${fullMatchStr}%`));
  }
  if (!queryStr) queryStr = `${getSelectStr(false)} from ${tableName}`;
  if (take !== undefined) {
    queryStr = queryStr + " limit ?";
    queryParams.push(take);
  }
  if (skip !== undefined) {
    queryStr = queryStr + " offset ?";
    queryParams.push(skip);
  }
  return { queryStr, queryParams };
};

/** TODO: support searching for special characters like ".[]" */
export const processText = (() => {
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

export const restoreText = (text: string) => text.replace(/\//g, "");
