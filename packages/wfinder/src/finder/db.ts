import { JsonMore } from "./../tools/json";

import { cEvFinderState } from "./events/core/coreEvents";
import { ConfigLine } from "./entities/ConfigLine";
import inquirer from "inquirer";
import { Connection, createConnection } from "typeorm";
import { exit, exitNthTodo, genDbThumnail } from "../tools/nodeTool";
import { FileInfo, IndexTableName } from "./entities/FileInfo";
import * as fs from "fs";
import { Config, entityChangeWatchingSubjectMap } from "./common";
import { ScanPath } from "./entities/ScanPath";
import { DbIncluded } from "./entities/DbIncluded";
import {
  EvConfigLineChange,
  EvFileInfoChange,
  EvScanPathChange,
  EvUiLaunched,
} from "./events/events";
import { ConfigLineType, TypeFinderCoreInfo } from "./types";
import { STR_FINDER_CORE_INFO } from "../constants";

const dbType = "better-sqlite3";
const initDb = async (dbPath: string) => {
  try {
    const connection = await createConnection({
      type: dbType,
      database: dbPath,
      synchronize: true,
      entities: [FileInfo, ConfigLine],
    });
    const { tableName } = connection.getMetadata(FileInfo);
    await connection.query(
      `CREATE VIRTUAL TABLE ${IndexTableName} USING fts4(content="${tableName}",
      tokenize=porter unicode61 "separators=/",
      name);`
    );
    await new ConfigLine(
      "^node_modules$",
      ConfigLineType.excludeChildrenFolderName
    ).save();
    await connection.close();
  } catch (e) {
    fs.unlinkSync(dbPath);
    console.error(e);
    exit("Create database failed.");
  }
};

export const AUTO_CONNECT_ENTITIES = [
  FileInfo,
  ScanPath,
  DbIncluded,
  ConfigLine,
];

// Register entity to trigger change event.
entityChangeWatchingSubjectMap.set(FileInfo, EvFileInfoChange);
entityChangeWatchingSubjectMap.set(ConfigLine, EvConfigLineChange);
entityChangeWatchingSubjectMap.set(ScanPath, EvScanPathChange);

// Register entity to serve remote orm method.
cEvFinderState.next({ remoteMethodServeEntityMap: { FileInfo } });

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
        if (config.readOnly || EvUiLaunched.value.ink)
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
    switchDb: async <T>(config: typeof Config, executor: () => Promise<T>) => {
      await switchConfig(config);
      dbConfigStack.push(config);
      try {
        return await executor();
      } finally {
        dbConfigStack.pop();
        switchConfig(dbConfigStack[dbConfigStack.length - 1] || Config);
      }
    },
    getSwitchedDbConfig: () =>
      dbConfigStack[dbConfigStack.length - 1] || Config,
  };
})();

let coreInfo: TypeFinderCoreInfo | undefined;
export const getFinderCoreInfo = async () => {
  if (!coreInfo) {
    coreInfo = await switchDb(Config, async () => {
      const info =
        (
          await ConfigLine.find({ where: { type: ConfigLineType.coreInfo } })
        )[0] || new ConfigLine(STR_FINDER_CORE_INFO, ConfigLineType.coreInfo);
      let json: TypeFinderCoreInfo | undefined;
      // @ts-ignore
      if (info.jsonStr) json = JsonMore.parse(info.jsonStr);
      if (!json) {
        json = {
          thumnail: await genDbThumnail(Config.dbPath),
        };
        info.jsonStr = JsonMore.stringify(json);
        await info.save();
      }
      return json;
    });
  }
  return coreInfo;
};
