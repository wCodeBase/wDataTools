import { FileInfo, FileType, IndexTableName } from "./entities/FileInfo";
import * as path from "path";
import * as fs from "fs";
import * as inquirer from "inquirer";
import { Connection, createConnection } from "typeorm";
const exitNthTodo = () => exit("Nothing to do, program will exit now.");
const exit = (reason: string) => {
  console.log(reason);
  process.exit();
};
const initDb = async (dbPath: string) => {
  try {
    const connection = await createConnection({
      type: "better-sqlite3",
      database: dbPath,
      entities: [FileInfo],
    });
    const { tableName } = connection.getMetadata(FileInfo);
    await connection.query(
      `CREATE VIRTUAL TABLE ${IndexTableName} USING fts4(content="${tableName}", name);`
    );
    await connection.close();
  } catch (e) {
    fs.unlinkSync(dbPath);
    console.error(e);
    exit("Create database failed.");
  }
};
const getConnection = (() => {
  let connection: Connection | undefined;
  return async () => {
    if (connection) return connection;
    const currentDir = path.resolve("./");
    const dbName = "wfinder.db";
    const dbPath = path.join(currentDir, dbName);
    if (!fs.existsSync(dbPath)) {
      const answer = await inquirer.prompt({
        name: "dbCreate",
        message: "Index database dosent exist, create it now?",
        type: "confirm",
      });
      if (!answer.dbCreate) exitNthTodo();
      console.log("Creating index database...");
      await initDb(dbPath);
    }
    connection = await createConnection({
      type: "better-sqlite3",
      name: "default",
      synchronize: true,
      database: dbPath,
      entities: [FileInfo],
    });
    const close = connection.close;
    connection.close = async () => {
      connection = undefined;
      await close();
    };
    return connection;
  };
})();
export const finder = async () => {
  const connection = await getConnection();
  await new FileInfo(
    "test-file-name0文件名" + Math.random(),
    FileType.file
  ).save();
  console.log(await FileInfo.findByMatchName("文件"));
};
