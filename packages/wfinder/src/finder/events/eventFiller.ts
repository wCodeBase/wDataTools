import { getConnection } from "../db";
import { FileInfo } from "../entities/FileInfo";
import { EvDatabaseInfos, EvFileInfoChange } from "./events";

EvFileInfoChange.subscribe(async () => {
  await getConnection();
  EvDatabaseInfos.next({
    fileInfoCount: await FileInfo.count(),
  });
});
