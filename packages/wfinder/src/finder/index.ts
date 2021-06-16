import { FileInfo, FileType, IndexTableName } from "./entities/FileInfo";
import { getConnection } from "./db";

export const finder = async () => {
  await getConnection();
  // TODO: ink ui.
};
