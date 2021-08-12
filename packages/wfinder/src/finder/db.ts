import { createNamespace } from "cls-hooked";
import * as fs from "fs";
import inquirer from "inquirer";
import path from "path";
import { Connection, createConnection, In } from "typeorm";
import { STR_FINDER_CORE_INFO } from "../constants";
import { exit, exitNthTodo, genDbThumbnail, pathPem } from "wnodetools";
import { JsonMore } from "wjstools";
import { Config, entityChangeWatchingSubjectMap, genConfig } from "./common";
import {
  cEvConfigLineChange,
  cEvDbIncludedChange,
  cEvFinderState,
  cEvScanPathChange,
} from "./events/core/coreEvents";
import { EvFileInfoChange, EvLogError, EvUiLaunched } from "./events/events";
import { executeUiCmd } from "./events/eventTools";
import { ConfigLineType, TypeDbInfo, TypeFinderCoreInfo } from "./types";
import { ConfigLine } from "./entities/ConfigLine";
import { DbIncluded } from "./entities/DbIncluded";
import { FileInfo, IndexTableName } from "./entities/FileInfo";
import { ScanPath } from "./entities/ScanPath";

export const createFtsTable = async (connection: Connection) => {
  const { tableName } = connection.getMetadata(FileInfo);
  await connection.query(
    `CREATE VIRTUAL TABLE ${IndexTableName} USING fts4(content="${tableName}",
    tokenize=porter unicode61 "separators=/",
    name);`
  );
};

const dbType = "better-sqlite3";
export const initDb = async (
  config: TypeDbInfo,
  prevConfig?: TypeDbInfo,
  reInitIfExist = false
) => {
  const { dbPath } = config;
  if (!path.isAbsolute(dbPath))
    throw new Error("dbPath should be absolute: " + JSON.stringify(config));
  let connection: Connection | undefined;
  if (fs.existsSync(config.dbPath)) {
    if (!reInitIfExist) return;
    await removeDbFiles(config.dbPath);
  }
  try {
    connection = await createConnection({
      type: dbType,
      database: dbPath,
      synchronize: true,
      entities: [FileInfo, ConfigLine],
      name: dbPath + Math.random().toString(36),
    });
    await createFtsTable(connection);
    await connection.close();
    connection = undefined;
    const postCreateConnection = async () => {
      clearTimeout(postCreateConnectionTimeout);
      postCreate.delete(dbPath, postCreateConnection);
      const prevConfigLines =
        prevConfig && prevConfig !== config
          ? await switchDb(prevConfig, async () => {
              return await ConfigLine.find({
                where: {
                  type: In([
                    ConfigLineType.excludeChildrenFolderName,
                    ConfigLineType.excludeFileName,
                  ]),
                },
              });
            })
          : [];
      await switchDb(config, async () => {
        if (prevConfig && prevConfig !== config) {
          prevConfigLines.forEach((v) => {
            v.dbInfo = config;
            // @ts-ignore
            v.id = undefined;
          });
          await ConfigLine.save(prevConfigLines);
        } else {
          await new ConfigLine(
            "^node_modules$",
            ConfigLineType.excludeChildrenFolderName
          ).save();
        }
      });
    };
    const postCreateConnectionTimeout = setTimeout(postCreateConnection, 10);
    postCreate.add(dbPath, postCreateConnection);
  } catch (e) {
    if (
      fs.existsSync(dbPath) &&
      Date.now() - fs.statSync(dbPath).ctime.valueOf() < 20 * 1000
    )
      await removeDbFiles(dbPath);
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
entityChangeWatchingSubjectMap.set(ConfigLine, cEvConfigLineChange);
entityChangeWatchingSubjectMap.set(ScanPath, cEvScanPathChange);
entityChangeWatchingSubjectMap.set(DbIncluded, cEvDbIncludedChange);

// Register entity to serve remote orm method.
cEvFinderState.next({ remoteMethodServeEntityMap: { FileInfo } });

const fakePath = "fakePath";
export const {
  getConnection,
  getCachedConnection,
  releaseConnection,
  postCreate,
} = (() => {
  const connectionMap = new Map<string, Connection>();
  let connectionIndex = 0;
  const blockingResolveMap = new Map<string, ((res: Connection) => void)[]>();
  const connectionLockMap = new Map<string, boolean | undefined>();
  const postCreateConnectionMap = new Map<string, (() => Promise<void>)[]>();
  return {
    getCachedConnection: (config = getConfig()) => {
      return connectionMap.get(config.dbPath);
    },
    postCreate: {
      add: (dbPath: string, cb: () => Promise<void>) => {
        postCreateConnectionMap.set(
          dbPath,
          (postCreateConnectionMap.get(dbPath) || []).concat(cb)
        );
      },
      delete: (dbPath: string, cb: () => Promise<void>) => {
        const cbs = postCreateConnectionMap
          .get(dbPath)
          ?.filter((v) => v !== cb);
        if (cbs?.length) postCreateConnectionMap.set(dbPath, cbs);
        else postCreateConnectionMap.delete(dbPath);
      },
    },
    releaseConnection: async (dbPath: string) => {
      if (connectionLockMap.has(dbPath) || blockingResolveMap.has(dbPath))
        throw new Error("Database busy now.");
      const connection = connectionMap.get(dbPath);
      if (connection) {
        connectionMap.delete(dbPath);
        await connection.close();
      }
    },
    getConnection: async (
      config = getConfig(),
      forceCreate = false,
      ignoreLock = false
    ): Promise<Connection> => {
      const { dbPath } = config;
      if (
        !path.isAbsolute(dbPath) &&
        dbPath.slice(0, fakePath.length) !== fakePath
      )
        throw new Error(
          "dbPath used in getConnection should be absolute: " + dbPath
        );
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
            !pathPem.canWrite(path.parse(dbPath).dir)
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
                pathPem.canWrite(path.join(userDataDir, config.dbName))
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
                    else if (!pathPem.canWrite(newPath))
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
          await initDb(config, getConfig());
        }
        connection = await createConnection({
          type: dbType,
          name:
            dbPath === Config.dbPath
              ? "default"
              : `connection-${connectionIndex++}`,
          synchronize: true,
          database: dbPath,
          entities: AUTO_CONNECT_ENTITIES,
        });
        if (!config.thumbnail) {
          const tmpConfig: TypeDbInfo = {
            ...config,
            dbPath:
              fakePath +
              (connectionIndex + 1) +
              Date.now().toString(36) +
              Math.random().toString(36),
          };
          connectionMap.set(tmpConfig.dbPath, connection);
          try {
            const coreInfo = await switchDb(tmpConfig, async () => {
              return await getFinderCoreInfo(undefined, tmpConfig);
            });
            config.thumbnail = coreInfo.thumbnail;
          } catch (e) {
            console.warn("Failed to get thumbnail of database", config, e);
          } finally {
            connectionMap.delete(tmpConfig.dbPath);
          }
        }
        connectionMap.set(dbPath, connection);
        const close = connection.close.bind(connection);
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
        await Promise.all(
          (postCreateConnectionMap.get(dbPath) || []).map((v) =>
            v().catch((e) => {
              EvLogError(
                `Error of postCreateConnection callback, dbpath: ${dbPath},error: ${e}`
              );
            })
          )
        );
      }
    },
  };
})();

export const { switchDb, getConfig, getDbFlags, getThumbnail } = (() => {
  const dbSession = (() => {
    const session = createNamespace("wfinderDbSession");
    const KEY_CONFIG = "key_config";
    const KEY_FLAGS = "key_flags";
    const defaultFlags = {
      willChange: true,
    };
    return {
      get: () => (session.get(KEY_CONFIG) || Config) as TypeDbInfo,
      flags: () =>
        (session.get(KEY_FLAGS) || defaultFlags) as Partial<
          typeof defaultFlags
        >,
      run: async <T>(
        config: TypeDbInfo,
        cb: () => Promise<T>,
        flags?: Partial<typeof defaultFlags>
      ) => {
        if (
          config.isSubDb &&
          config.dbPath.slice(0, fakePath.length) !== fakePath &&
          !fs.existsSync(config.dbPath)
        ) {
          await initDb(config, getConfig());
        }
        await getConnection(config);
        return session.runAndReturn(async () => {
          session.set(KEY_CONFIG, config);
          if (flags) session.set(KEY_FLAGS, flags);
          return await cb();
        });
      },
    };
  })();
  return {
    switchDb: dbSession.run,
    getConfig: dbSession.get,
    getDbFlags: dbSession.flags,
    getThumbnail: async (dbPath: string) => {
      return (
        await getFinderCoreInfo(false, { finderRoot: "", dbName: "", dbPath })
      ).thumbnail;
    },
  };
})();

let coreInfo: TypeFinderCoreInfo | undefined;
let coreInfoDbPath = "";
export const getFinderCoreInfo = async (
  notSubDb = false,
  useConfig?: TypeDbInfo
) => {
  const config =
    useConfig ||
    (notSubDb
      ? cEvFinderState.value.configStack
          .slice(0, cEvFinderState.value.configIndex)
          .reverse()
          .find((v) => !v.isSubDb)
      : Config) ||
    Config;
  if (!coreInfo || config?.dbPath !== coreInfoDbPath) {
    coreInfo = await switchDb(config || Config, async () => {
      const info =
        (
          await ConfigLine.find({ where: { type: ConfigLineType.coreInfo } })
        )[0] || new ConfigLine(STR_FINDER_CORE_INFO, ConfigLineType.coreInfo);
      let json: TypeFinderCoreInfo | undefined;
      // @ts-ignore
      if (info.jsonStr) json = JsonMore.parse(info.jsonStr);
      if (!json?.thumbnail) {
        json = {
          ...(json || {}),
          thumbnail: await genDbThumbnail(Config.dbPath),
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

export const removeDbFiles = async (absDbPath: string) => {
  if (!fs.existsSync(absDbPath)) return;
  await releaseConnection(absDbPath);
  ["", "-shm", "-wal"].forEach((v) => {
    const fPath = absDbPath + v;
    if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
  });
};
