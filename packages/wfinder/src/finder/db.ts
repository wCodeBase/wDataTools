import inquirer from "inquirer";
import { Connection, createConnection } from "typeorm";
import { exit, exitNthTodo } from "../tools/tool";
import { FileInfo, IndexTableName } from "./entities/FileInfo";
import * as fs from "fs";
import { Config } from "./common";
import { ScanPath } from "./entities/ScanPath";
import { DbIncluded } from "./entities/DbIncluded";
import { EvUiStatus } from "./events/events";

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
      `CREATE VIRTUAL TABLE ${IndexTableName} USING fts4(content="${tableName}",
      tokenize=porter unicode61 "separators=/",
      name);`
    );
    await connection.close();
  } catch (e) {
    fs.unlinkSync(dbPath);
    console.error(e);
    exit("Create database failed.");
  }
};

export const AUTO_CONNECT_ENTITIES = [FileInfo, ScanPath, DbIncluded];

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
    try {
      if (!fs.existsSync(dbPath)) {
        if (config.readOnly || EvUiStatus.value.ink)
          throw new Error("DbPath not exist: " + dbPath);
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
        name:
          dbPath === Config.dbPath
            ? "default"
            : `connection-${connectionMap.size}`,
        synchronize: true,
        database: dbPath,
        entities: AUTO_CONNECT_ENTITIES,
      });
      connectionMap.set(dbPath, connection);
      const close = connection.close;
      connection.close = async () => {
        connectionMap.delete(dbPath);
        await close();
      };
      const con = connection;
      blockingResolveMap.get(dbPath)?.forEach((v) => v(con));
      blockingResolveMap.delete(dbPath);
      return connection;
    } finally {
      connectionLockMap.delete(dbPath);
    }
  };
})();

export const { switchDb, getSwitchedDbConfig } = (() => {
  const dbConfigStack: typeof Config[] = [];
  const switchConfig = async (config = Config) => {
    const connection = await getConnection(config);
    AUTO_CONNECT_ENTITIES.forEach((v) => v.useConnection(connection));
  };
  return {
    switchDb: async (config: typeof Config, executor: () => Promise<void>) => {
      await switchConfig(config);
      dbConfigStack.push(config);
      try {
        await executor();
      } finally {
        dbConfigStack.pop();
        switchConfig(dbConfigStack[dbConfigStack.length - 1] || Config);
      }
    },
    getSwitchedDbConfig: () =>
      dbConfigStack[dbConfigStack.length - 1] || Config,
  };
})();
