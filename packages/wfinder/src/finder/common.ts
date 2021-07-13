import { Subject } from "rxjs";
import { BaseDbInfoEntity } from "./entities/BaseDbInfoEntity";
import * as path from "path";
import { EvDefaultDbInfo } from "./events/events";
import { ConfigLineType, TypeDbInfo, TypeFinderCoreInfo } from "./types";
import { ObjectType } from "typeorm";

export const genConfig = (finderRoot: string) => {
  const dbName = "wfinder.db";
  const dbPath = path.join(finderRoot, dbName);
  return {
    /** Root path for indexing, only files included in this path will be scan and index */
    finderRoot,
    dbName,
    /** Absolute path for database connection */
    dbPath,
    readOnly: false,
  } as TypeDbInfo;
};

export const Config = genConfig(path.resolve("./"));

export const entityChangeWatchingSubjectMap = new Map<
  ObjectType<BaseDbInfoEntity>,
  Subject<null>
>();

EvDefaultDbInfo.next(Config);

export const DEFAULT_QUERY_LIMIT = {
  dbThumnailStack: [],
  remoteLimit: 10,
};