import * as path from "path";
import { Subject } from "rxjs";
import { ObjectType } from "typeorm";
import { BaseDbInfoEntity } from "./entities/BaseDbInfoEntity";
import { TypeDbInfo } from "./types";

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

export const MAX_PATH_DEPTH = 1000;

export const entityChangeWatchingSubjectMap = new Map<
  ObjectType<BaseDbInfoEntity>,
  Subject<TypeDbInfo | null>
>();

export const DEFAULT_QUERY_LIMIT = {
  dbThumbnailStack: [],
  remoteLimit: 10,
};

export const isDev = process.env.NODE_ENV === "development";
