import inquirer from "inquirer";
import path from "path";
import { Connection, createConnection } from "typeorm";
import { exit, exitNthTodo } from "../tools/tool";
import { FileInfo, IndexTableName } from "./entities/FileInfo";
import * as fs from "fs";
import { Config } from "./common";
import { ScanPath } from "./entities/ScanPath";

const dbType = "better-sqlite3";

const initDb = async (dbPath: string) => {
  try {
    const connection = await createConnection({
      type: dbType,
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

export const getConnection = (() => {
  const connectionMap = new Map<string, Connection>();
  const blockingResolveMap = new Map<string, ((res: Connection) => void)[]>();
  const connectionLockMap = new Map<string, boolean | undefined>();
  return async (config = Config) => {
    const { dbPath } = config;
    let connection = connectionMap.get(dbPath);
    if (connection) return connection;
    const lock = connectionLockMap.get(dbPath);
    if (lock) {
      return new Promise<Connection>((r) => {
        const resolves = blockingResolveMap.get(dbPath) || [];
        resolves.push(r);
        blockingResolveMap.set(dbPath, resolves);
      });
    } else connectionLockMap.set(dbPath, true);
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
      type: dbType,
      name: "default",
      synchronize: true,
      database: dbPath,
      entities: [FileInfo, ScanPath],
    });
    connectionMap.set(dbPath, connection);
    const close = connection.close;
    connection.close = async () => {
      connectionMap.delete(dbPath);
      await close();
    };
    connectionLockMap.delete(dbPath);
    blockingResolveMap.get(dbPath)?.forEach((v) => v(connection!));
    blockingResolveMap.delete(dbPath);
    return connection;
  };
})();
