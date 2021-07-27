import path from "path";
import { Subject } from "rxjs";
import {
  BaseEntity,
  FindConditions,
  ObjectID,
  ObjectType,
  RemoveOptions,
  SaveOptions,
} from "typeorm";
import { TypeJsonData } from "../../tools/json";
import {
  isPathEqual,
  joinToAbsolute,
  isPathInclude,
} from "../../tools/pathTool";
import { entityChangeWatchingSubjectMap } from "../common";
import {
  getConnection,
  getFinderCoreInfo,
  getConfig,
  getCachedConnection,
  switchDb,
} from "../db";
import { cEvFinderState } from "../events/core/coreEvents";
import { cTypeImplementedOrmCall } from "../events/core/coreTypes";
import { EvLog } from "../events/events";
import { TypeQueryLimit } from "../types";

export type SubDatabaseIterator = (cb: () => Promise<void>) => Promise<void>;

export const SubDatabaseIterators: SubDatabaseIterator[] = [];

export class BaseDbInfoEntity extends BaseEntity {
  constructor(...v: any) {
    super();
  }

  public static async queryAllDbIncluded<E extends typeof BaseDbInfoEntity, T>(
    this: E,
    doQuery: (handle: typeof this) => Promise<T[]>
  ) {
    let res: T[] = await doQuery(this);
    for (const cb of SubDatabaseIterators) {
      await cb(async () => {
        res = res.concat(await this.queryAllDbIncluded(doQuery));
      });
    }
    return res;
  }

  async save(options?: SaveOptions) {
    const res = await super.save(options);
    entityChangeWatchingSubjectMap.get(this.constructor)?.next(getConfig());
    return res;
  }

  async remove(options?: RemoveOptions) {
    const res = await super.remove(options);
    entityChangeWatchingSubjectMap.get(this.constructor)?.next(getConfig());
    return res;
  }
  static async remove<T extends BaseEntity>(
    entities: T[],
    options?: RemoveOptions
  ) {
    const res = await super.remove(entities, options);
    entityChangeWatchingSubjectMap.get(this)?.next(getConfig());
    return res as T[];
  }
  static async save<T extends BaseEntity>(
    entities: T[],
    options?: SaveOptions
  ) {
    const res = await super.save(entities, options);
    entityChangeWatchingSubjectMap.get(this)?.next(getConfig());
    return res as T[];
  }
  static async delete<T extends BaseEntity>(
    criteria:
      | string
      | string[]
      | number
      | number[]
      | Date
      | Date[]
      | ObjectID
      | ObjectID[]
      | FindConditions<T>,
    options?: RemoveOptions
  ) {
    const res = await super.delete(criteria, options);
    entityChangeWatchingSubjectMap.get(this)?.next(null);
    return res;
  }

  dbInfo = getConfig();

  static async *callRemoteStaticMethod(
    method: cTypeImplementedOrmCall,
    args: TypeJsonData[],
    queryLimit: TypeQueryLimit
  ) {
    if (queryLimit.remoteLimit < 1) return undefined;
    const newQueryLimit: TypeQueryLimit = {
      dbThumnailStack: [
        ...queryLimit.dbThumnailStack,
        (await getFinderCoreInfo()).thumnail,
      ],
      remoteLimit: queryLimit.remoteLimit - 1,
    };
    // @ts-ignore
    if (typeof this[method] !== "function")
      throw new Error(`Method not found in entity ${this.name}`);
    for (const [url, remote] of Object.entries(
      cEvFinderState.value.linkedRemote
    )) {
      if (remote.caller) {
        try {
          const rRes = await remote.caller.call({
            cmd: "callOrmMethod",
            data: {
              entityName: this.name,
              method,
              args,
              queryLimit: newQueryLimit,
            },
          });
          yield { url, rRes };
        } catch (e) {
          EvLog(
            `Error: query remote failed, method: countByMatchName, args: ${args},remote: ${url} error: `,
            e
          );
        }
      }
    }
  }
}

const triggerChangeMethods = new Set([
  "save",
  "remove",
  "softRemove",
  "insert",
  "update",
  "delete",
  "query",
  "clear",
] as (keyof typeof BaseDbInfoEntity)[]);

(
  [
    "save",
    "remove",
    "softRemove",
    "reload",
    "recover",
  ] as (keyof BaseDbInfoEntity)[]
).forEach((p) => {
  const old = BaseDbInfoEntity.prototype[p];
  if (typeof old === "function") {
    // @ts-ignore
    BaseDbInfoEntity.prototype[p] = function (...args: any) {
      const connection = getCachedConnection(getConfig());
      if (connection)
        // @ts-ignore
        this.constructor.useConnection(getCachedConnection(getConfig()));
      // @ts-ignore
      return old.apply(this, args);
    };
    // @ts-ignore
    if (triggerChangeMethods.has(p)) {
      // @ts-ignore
      BaseDbInfoEntity.prototype[p] = async function (...args: any) {
        const connection = getCachedConnection(getConfig());
        if (connection)
          // @ts-ignore
          this.constructor.useConnection(getCachedConnection(getConfig()));
        // @ts-ignore
        const res = await old.apply(this, args);
        entityChangeWatchingSubjectMap.get(this.constructor)?.next(getConfig());
        return res;
      };
    }
  }
});

(
  [
    "getRepository",
    "createQueryBuilder",
    "create",
    "preload",
    "save",
    "remove",
    "softRemove",
    "insert",
    "update",
    "delete",
    "count",
    "find",
    "findAndCount",
    "findByIds",
    "findOne",
    "findOneOrFail",
    "query",
    "clear",
  ] as (keyof typeof BaseDbInfoEntity)[]
).forEach((p) => {
  const old = BaseDbInfoEntity[p];
  if (typeof old === "function") {
    // @ts-ignore
    BaseDbInfoEntity[p] = function (...args: any) {
      const connection = getCachedConnection(getConfig());
      if (connection) this.useConnection(connection);
      // @ts-ignore
      return old.apply(this, args);
    };
    if (triggerChangeMethods.has(p)) {
      // @ts-ignore
      BaseDbInfoEntity[p] = function (...args: any) {
        const connection = getCachedConnection(getConfig());
        if (connection) this.useConnection(connection);
        // @ts-ignore
        const res = old.apply(this, args);
        entityChangeWatchingSubjectMap.get(this)?.next(getConfig());
        return res;
      };
    }
  }
});
