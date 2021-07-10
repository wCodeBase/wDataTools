import * as path from "path";
import { EvDefaultDbInfo } from "./events/events";
import { TypeDbInfo } from "./types";

export const Config = (() => {
  const finderRoot = path.resolve("./");
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
})();

EvDefaultDbInfo.next(Config);
