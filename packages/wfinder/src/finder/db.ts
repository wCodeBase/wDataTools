import { JsonMore } from "./../tools/json";
import path from "path";
import { cEvFinderState } from "./events/core/coreEvents";
import { ConfigLine } from "./entities/ConfigLine";
import inquirer from "inquirer";
import { Connection, createConnection } from "typeorm";
import {
  exit,
  exitNthTodo,
  genDbThumnail,
  getPathPermission,
} from "../tools/nodeTool";
import { FileInfo, IndexTableName } from "./entities/FileInfo";
import * as fs from "fs";
import { Config, entityChangeWatchingSubjectMap, genConfig } from "./common";
import { ScanPath } from "./entities/ScanPath";
import { DbIncluded } from "./entities/DbIncluded";
import {
  EvConfigLineChange,
  EvDbIncludedChange,
  EvFileInfoChange,
  EvScanPathChange,
  EvUiCmd,
  EvUiLaunched,
} from "./events/events";
import { ConfigLineType, TypeDbInfo, TypeFinderCoreInfo } from "./types";
import { STR_FINDER_CORE_INFO } from "../constants";
import { executeUiCmd } from "./events/eventTools";
import { createNamespace, getNamespace } from "cls-hooked";

export const createFtsTable = async (connection: Connection) => {
  const { tableName } = connection.getMetadata(FileInfo);
  await connection.query(
    `CREATE VIRTUAL TABLE ${IndexTableName} USING fts4(content="${tableName}",
    tokenize=porter unicode61 "separators=/",
    name);`
  );
};

const dbType = "better-sqlite3";
const initDb = async (config: TypeDbInfo) => {
  const { dbPath } = config;
  let connection: Connection | undefined;
  try {
    connection = await createConnection({
      type: dbType,
      database: dbPath,
      synchronize: true,
      entities: [FileInfo, ConfigLine],
      name: dbPath,
    });
    await createFtsTable(connection);
    await new ConfigLine(
      "^node_modules$",
      ConfigLineType.excludeChildrenFolderName
    ).save();
    await connection.close();
    connection = undefined;
  } catch (e) {
    if (
      fs.existsSync(dbPath) &&
      Date.now() - fs.statSync(dbPath).ctime.valueOf() < 20 * 1000
    )
      fs.unlinkSync(dbPath);
    console.error(e);
    connection?.close();
    if (!config.isSubDb && !Object.values(EvUiLaunched.value).some((v) => v)) {
      exit("Create database failed.");
    } else throw e;
  }
};

export const AUTO_CONNECT_ENTITIES = [
  FileInfo,
  ScanPath,
  DbIncluded,
  ConfigLine,
];

// TODO: FIXME: support different database context, auto refresh.
// Register entity to trigger change event.
entityChangeWatchingSubjectMap.set(FileInfo, EvFileInfoChange);
entityChangeWatchingSubjectMap.set(ConfigLine, EvConfigLineChange);
entityChangeWatchingSubjectMap.set(ScanPath, EvScanPathChange);
entityChangeWatchingSubjectMap.set(DbIncluded, EvDbIncludedChange);

// Register entity to serve remote orm method.
cEvFinderState.next({ remoteMethodServeEntityMap: { FileInfo } });

export const { getConnection, getCachedConnection } = (() => {
  const connectionMap = new Map<string, Connection>();
  const blockingResolveMap = new Map<string, ((res: Connection) => void)[]>();
  const connectionLockMap = new Map<string, boolean | undefined>();
  return {
    getCachedConnection: (config = getConfig()) => {
      return connectionMap.get(config.dbPath);
    },
    getConnection: async (
      config = getConfig(),
      forceCreate = false,
      ignoreLock = false
    ): Promise<Connection> => {
      const { dbPath } = config;
      let connection = connectionMap.get(dbPath);
      if (connection) return connection;
      const lock = connectionLockMap.get(dbPath);
      if (lock && !ignoreLock) {
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
          if (
            (!forceCreate && !config.isSubDb) ||
            !getPathPermission(path.parse(dbPath).dir).write
          ) {
            // Only global database config be initialed.
            if (config !== Config)
              throw new Error(
                "Failed to create connection to config: " +
                  JSON.stringify(config)
              );
            if (EvUiLaunched.value.electron || EvUiLaunched.value.web) {
              let userDataDir: string | undefined;
              if (EvUiLaunched.value.electron) {
                try {
                  userDataDir = (
                    await executeUiCmd("queryUserDataDir", {
                      cmd: "queryUserDataDir",
                    })
                  ).result;
                } catch (e) {
                  console.error("queryUserDataDir failed: ", e);
                }
              }
              let newDbPath = "";
              if (
                userDataDir &&
                getPathPermission(path.join(userDataDir, config.dbName)).write
              ) {
                newDbPath = userDataDir;
              } else {
                let message = "";
                while (true) {
                  try {
                    const res = await executeUiCmd(
                      "requestChooseFinderRoot",
                      {
                        cmd: "requestChooseFinderRoot",
                        tag: Math.random(),
                        data: {
                          cwd: process.cwd(),
                          userDataDir,
                          currentDatabaseDir: path.parse(dbPath).dir,
                          message,
                        },
                      },
                      Infinity
                    );
                    const { finderRoot } = res.result;
                    const newPath = path.resolve(finderRoot);
                    if (
                      finderRoot === userDataDir &&
                      !fs.existsSync(userDataDir)
                    )
                      fs.mkdirSync(userDataDir);
                    if (!fs.existsSync(newPath))
                      message = `Error: path "${newPath}" dosen't exist.`;
                    else if (!getPathPermission(newPath).write)
                      message = `Error: path "${newPath}" is not writable.`;
                    else {
                      newDbPath = newPath;
                      break;
                    }
                  } catch (e) {
                    console.error("requestChooseFinderRoot failed: ", e);
                  }
                }
              }
              const newConfig = genConfig(newDbPath);
              const stackedConfig = cEvFinderState.value.configStack.find(
                (v) => v.dbPath === Config.dbPath
              );
              if (stackedConfig) {
                Object.assign(stackedConfig, newConfig);
                cEvFinderState.next({
                  configStack: [...cEvFinderState.value.configStack],
                });
              }
              Object.assign(Config, newConfig);
              return await getConnection(
                Config,
                true,
                newConfig.dbPath === dbPath
              );
            } else {
              const answer = await inquirer.prompt({
                name: "dbCreate",
                message: "Index database dosent exist, create it now?",
                type: "confirm",
              });
              if (!answer.dbCreate) exitNthTodo();
            }
          }
          console.log("Creating index database...");
          await initDb(config);
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
        if (config === Config && !config.thumbnail) {
          connectionLockMap.delete(dbPath);
          try {
            const coreInfo = await getFinderCoreInfo();
            config.thumbnail = coreInfo.thumnail;
          } catch (e) {
            console.warn("Failed to get thumbnail of  global database");
          }
        }
        return connection;
      } finally {
        connectionLockMap.delete(dbPath);
      }
    },
  };
})();

export const { switchDb, getConfig } = (() => {
  const dbSession = (() => {
    const session = createNamespace("wfinderDbSession");
    const KEY_CONFIG = "key_config";
    return {
      get: () => (session.get(KEY_CONFIG) || Config) as TypeDbInfo,
      run: async <T>(config: TypeDbInfo, cb: () => Promise<T>) => {
        const connection = await getConnection(config);
        return session.runPromise(async () => {
          session.set(KEY_CONFIG, config);
          return await cb();
        });
      },
    };
  })();
  return {
    switchDb: dbSession.run,
    getConfig: dbSession.get,
  };
})();

let coreInfo: TypeFinderCoreInfo | undefined;
let coreInfoDbPath = "";
export const getFinderCoreInfo = async (notSubDb = false) => {
  const config =
    (notSubDb
      ? cEvFinderState.value.configStack
          .slice(0, cEvFinderState.value.configIndex)
          .reverse()
          .find((v) => !v.isSubDb)
      : Config) || Config;
  if (!coreInfo || config?.dbPath !== coreInfoDbPath) {
    coreInfo = await switchDb(config || Config, async () => {
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
    coreInfoDbPath = config.dbPath;
  }
  return coreInfo;
};
