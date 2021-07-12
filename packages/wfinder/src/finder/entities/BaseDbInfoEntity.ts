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
import { entityChangeWatchingSubjectMap } from "../common";
import { getFinderCoreInfo, getSwitchedDbConfig } from "../db";
import { cEvFinderState } from "../events/core/coreEvents";
import { cTypeImplementedOrmCall } from "../events/core/coreTypes";
import { EvLog } from "../events/events";
import { TypeQueryLimit } from "../types";

export class BaseDbInfoEntity extends BaseEntity {
  async save(options?: SaveOptions) {
    const res = await super.save(options);
    // @ts-ignore
    entityChangeWatchingSubjectMap.get(this.constructor)?.next(null);
    return res;
  }

  async remove(options?: RemoveOptions) {
    const res = await super.remove(options);
    // @ts-ignore
    entityChangeWatchingSubjectMap.get(this.constructor)?.next(null);
    return res;
  }
  static async remove<T extends BaseEntity>(
    entities: T[],
    options?: RemoveOptions
  ) {
    const res = await super.remove(entities, options);
    // @ts-ignore
    entityChangeWatchingSubjectMap.get(this.constructor)?.next(null);
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
    // @ts-ignore
    entityChangeWatchingSubjectMap.get(this.constructor)?.next(null);
    return res;
  }

  dbInfo = getSwitchedDbConfig();

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
