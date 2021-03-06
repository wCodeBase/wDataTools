import {
  BaseEntity,
  FindConditions,
  ObjectID,
  RemoveOptions,
  SaveOptions,
} from "typeorm";
import { TypeJsonData } from "../../tools/json";
import { interactYield } from "../../tools/tool";
import { entityChangeWatchingSubjectMap } from "../common";
import { getCachedConnection, getConfig, getFinderCoreInfo } from "../db";
import { cEvFinderState } from "../events/core/coreEvents";
import { cTypeImplementedOrmCall } from "../events/core/coreTypes";
import { EvLogError } from "../events/events";
import { TypeQueryLimit } from "../types";
import { Config } from "./../common";

export type SubDatabaseIterator = (cb: () => Promise<void>) => Promise<void>;

export const SubDatabaseIterators: SubDatabaseIterator[] = [];

export class BaseDbInfoEntity extends BaseEntity {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(...v: any) {
    super();
  }

  public static async queryAllDbIncluded<E extends typeof BaseDbInfoEntity, T>(
    this: E,
    doQuery: (handle: typeof this) => Promise<T[]>,
    selfFirst = true
  ) {
    let res: T[] = selfFirst ? await doQuery(this) : [];
    for (const cb of SubDatabaseIterators) {
      await cb(async () => {
        await interactYield();
        res = res.concat(await this.queryAllDbIncluded(doQuery, selfFirst));
      });
    }
    if (!selfFirst) res = res.concat(await doQuery(this));
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
          EvLogError(
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

const entityTableNameMap = new Map<typeof BaseDbInfoEntity, string>();
export const getEntityTableName = (entity: typeof BaseDbInfoEntity) => {
  let tableName = entityTableNameMap.get(entity);
  if (tableName) return tableName;
  const connection = getCachedConnection(Config);
  if (!connection)
    throw new Error("getEntityTableName cached connection not found.");
  tableName = connection.getMetadata(entity).tableName;
  entityTableNameMap.set(entity, tableName);
  return tableName;
};
