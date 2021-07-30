import { interactYield } from "./../tools/tool";
import { ConfigLine } from "./entities/ConfigLine";
import { cEvScanBrake } from "./events/core/coreEvents";
import { Config, isDev, MAX_PATH_DEPTH } from "./common";
import * as path from "path";
import * as fs from "fs";
import { pathPem, TimeCouter } from "../tools/nodeTool";
import {
  isPathEqual,
  isPathInclude,
  joinToAbsolute,
  splitPath,
} from "../tools/pathTool";
import { FileInfo, processText, restoreText } from "./entities/FileInfo";
import { switchDb, getConnection, getConfig } from "./db";
import { ScanPath } from "./entities/ScanPath";
import { EvFinderStatus, EvLogError, EvUiCmdMessage } from "./events/events";
import { FinderStatus } from "./events/types";
import { DbIncluded } from "./entities/DbIncluded";
import { ConfigLineType, FileType, getDbInfoId } from "./types";
import { createNamespace, getNamespace } from "cls-hooked";
import { SUB_DATABASE_PREFIX } from "../constants";
import { BehaviorSubject } from "rxjs";
import { Not } from "typeorm";
import { getEntityTableName } from "./entities/BaseDbInfoEntity";

export class FileScanError extends Error {}

const testAndScanSubDb = async (
  testAbsPath: string,
  ignoreCtime = false,
  config = Config,
  currentDepth = 0,
  scanBrake: BehaviorSubject<boolean>
) => {
  if (isPathEqual(testAbsPath, config.finderRoot)) return false;
  const testDbPath = path.join(testAbsPath, config.dbName);
  if (
    fs.existsSync(testDbPath) &&
    fs.statSync(testDbPath).isFile() &&
    pathPem.canWrite(testDbPath)
  ) {
    EvUiCmdMessage.next({
      type: "log",
      message: `Sub database found: ${testDbPath}`,
    });
    await DbIncluded.remove(
      (
        await DbIncluded.find()
      ).filter((v) =>
        isPathInclude(testAbsPath, joinToAbsolute(v.dbInfo.finderRoot, v.path))
      )
    );
    await DbIncluded.mark(
      path.relative(config.finderRoot, testAbsPath),
      config.dbName
    );
    await doScan(
      {
        ...config,
        dbPath: testDbPath,
        finderRoot: testAbsPath,
        isSubDb: true,
      },
      false,
      ignoreCtime,
      currentDepth + 1,
      undefined,
      scanBrake
    );
    return testDbPath;
  }
  return false;
};

export const scanPath = async (
  pathOrScanPath: string | ScanPath,
  ignoreCtime = false,
  config = Config,
  currentDepth = 0,
  scanBrake: BehaviorSubject<boolean>
) => {
  return await switchDb(config, async (): Promise<string[]> => {
    const errors: string[] = [];
    const pathToScan = joinToAbsolute(
      config.finderRoot,
      pathOrScanPath instanceof ScanPath ? pathOrScanPath.path : pathOrScanPath
    );
    const { finderRoot } = config;
    const clsVars = clsScan.get();
    if (!fs.existsSync(pathToScan))
      throw new FileScanError("Path to scan is not exist.");
    if (!isPathInclude(finderRoot, pathToScan))
      throw new FileScanError("Path to scan is not included in finderRoot.");

    let parentId = -1;
    const pathSegs = splitPath(path.relative(finderRoot, pathToScan));
    while (true) {
      const pathSeg = pathSegs.pop();
      if (!pathSeg) break;
      const existPath = await FileInfo.getOrInsert(
        pathSeg,
        FileType.folder,
        new Date(),
        parentId
      );
      clsVars.scanedFileCount++;
      parentId = existPath.id;
    }
    if (fs.statSync(pathToScan).isFile()) {
      const fileInfo = await FileInfo.findOne(parentId);
      if (!fileInfo)
        throw new FileScanError(
          "ScanPath segements generate error, scanPath is file but no fileInfo created."
        );
      fileInfo.type = FileType.file;
      fileInfo.size = fs.statSync(pathToScan).size;
      await fileInfo.save();
      clsVars.scanedFileCount++;
      return errors;
    } else {
      const scanStack = [
        {
          id: parentId,
          absPath: pathToScan,
          restChildren: fs.readdirSync(pathToScan),
          ctime: fs.statSync(pathToScan).ctime,
          changed: true,
          depth: currentDepth,
        },
      ];

      enum ExcludeType {
        false,
        current,
        children,
      }
      const judgeExcludeType = await (async () => {
        const [current, children] = await Promise.all(
          [
            ConfigLineType.excludeFileName,
            ConfigLineType.excludeChildrenFolderName,
          ].map(async (type) => {
            return (await ConfigLine.find({ where: { type } })).map(
              (v) => new RegExp(v.content)
            );
          })
        );
        return (fileName: string) => {
          if (current.some((v) => v.test(fileName))) return ExcludeType.current;
          if (children.some((v) => v.test(fileName)))
            return ExcludeType.children;
          return ExcludeType.false;
        };
      })();
      const fileInfoTableName = getEntityTableName(FileInfo);
      const folderNameQuery = `select name from ${fileInfoTableName} where parentId = ? and type is not ${FileType.file} `;
      while (!scanBrake.value) {
        const item = scanStack.pop();
        if (!item) break;
        if (item.depth > MAX_PATH_DEPTH) {
          EvUiCmdMessage.next({
            type: "error",
            message: `Error: Reach max path depth(${MAX_PATH_DEPTH}): ${item.absPath}`,
          });
          break;
        }
        if (item.changed) {
          await FileInfo.removeUnexistChildren(
            item.id,
            item.restChildren,
            scanBrake
          );
        }
        for (const name of item.restChildren) {
          clsVars.scanedFileCount++;
          if (scanBrake.value) break;
          const echo = await interactYield(5, 5000);
          if (echo) {
            EvUiCmdMessage.next({
              type: "log",
              message:
                `Current scan (count：${clsVars.scanedFileCount}): ` +
                item.absPath,
            });
          }
          const excludeType = judgeExcludeType(name);
          if (excludeType === ExcludeType.current) {
            await FileInfo.removeChildren(item.id, [name], scanBrake);
            continue;
          }
          const chilPath = path.join(item.absPath, name);
          const stat = fs.statSync(chilPath);
          if (stat.isFile()) {
            if (item.changed)
              await FileInfo.getOrInsert(
                name,
                FileType.file,
                stat.ctime,
                item.id,
                stat.size
              );
          } else {
            const changed =
              ignoreCtime ||
              (
                await FileInfo.findByNameWhere(name, { parentId: item.id })
              )[0]?.ctime.valueOf() !== stat.ctime.valueOf();
            const info = await FileInfo.getOrInsert(
              name,
              FileType.folder,
              stat.ctime,
              item.id
            );
            if (excludeType === ExcludeType.children) {
              FileInfo.removeChildren(info.id, undefined, scanBrake);
            } else if (!pathPem.canRead(chilPath)) {
              errors.push(`Path unreadable: ${chilPath}`);
            } else {
              if (
                !(await testAndScanSubDb(
                  chilPath,
                  ignoreCtime,
                  config,
                  item.depth,
                  scanBrake
                ))
              ) {
                let restChildren: string[];
                if (changed) restChildren = fs.readdirSync(chilPath);
                else {
                  clsVars.scanedFileCount += await FileInfo.count({
                    where: { parentId: info.id, type: FileType.file },
                  });
                  restChildren = (
                    await FileInfo.query(folderNameQuery, [info.id])
                  ).map((v: { name: string }) => restoreText(v.name));
                }
                scanStack.push({
                  id: info.id,
                  absPath: chilPath,
                  restChildren,
                  ctime: stat.ctime,
                  changed,
                  depth: item.depth + 1,
                });
              }
            }
          }
        }
        if (!scanBrake.value) {
          const info = await FileInfo.findOne(item.id);
          if (info && info.ctime.valueOf() !== item.ctime.valueOf()) {
            info.ctime = item.ctime;
            await info.save();
          }
        } else {
          // Scanning is break off here, reset unfinished folder's ctime for next scanning.
          const unfinished = await FileInfo.findByIds([
            item.id,
            ...scanStack.map((v) => v.id),
          ]);
          const ctime = new Date(0);
          unfinished.forEach((v) => (v.ctime = ctime));
          await FileInfo.save(unfinished);
        }
      }
    }

    await DbIncluded.removeUnexists();
    return errors;
  });
};

const getScanAbspath = async (paths?: string[], config = getConfig()) => {
  return await switchDb(config, async () => {
    const absPaths = (paths || (await ScanPath.find()).map((v) => v.path)).map(
      (v) => joinToAbsolute(config.finderRoot, v)
    );
    if (!absPaths.length) absPaths.push(config.finderRoot);
    return absPaths;
  });
};

export const stopScan = async (paths?: string[], config = getConfig()) => {
  const absPaths = await getScanAbspath(paths, config);
  const brake = cEvScanBrake.value;
  absPaths.forEach((v) => (brake[v] = config));
  cEvScanBrake.next({ ...brake });
};

const clsScan = (() => {
  const cls = createNamespace("clsScan");
  const clsVarKey = "scanVars";
  const genScanVars = () => {
    return {
      currentStartAt: new Date(),
      startAt: new Date(),
      Scaned: new Set<string>(),
      limitPathSet: undefined as Set<string> | undefined,
      startConfig: getConfig(),
      scanedFileCount: 0,
    };
  };
  const defaultScanVar = genScanVars();
  return {
    runPromise: cls.runPromise.bind(cls),
    update(values?: Partial<typeof defaultScanVar>) {
      const exist: typeof defaultScanVar | undefined = cls.get(clsVarKey);
      const toSet = exist ? { ...exist } : genScanVars();
      toSet.currentStartAt = new Date();
      if (values) Object.assign(toSet, values);
      cls.set(clsVarKey, toSet);
    },
    get(): typeof defaultScanVar {
      return cls.get(clsVarKey) || defaultScanVar;
    },
  };
})();

const resetScanBrake = async (paths?: string[], config = getConfig()) => {
  const absPaths = await getScanAbspath(paths, config);
  const brake = cEvScanBrake.value;
  absPaths.forEach((v) => delete brake[v]);
  cEvScanBrake.next({ ...brake });
};

const checkScanBrake = async (paths?: string[], config = getConfig()) => {
  const absPaths = await getScanAbspath(paths, config);
  const brake = cEvScanBrake.value;
  return !!absPaths.find((v) => brake[v]);
};

export const doScan = async (
  config = getConfig(),
  isScanRoot = true,
  ignoreCtime = false,
  currentDepth = 0,
  paths?: string[],
  scanBrake?: BehaviorSubject<boolean>
) => {
  let errors: string[] = [];
  if (isScanRoot) {
    await clsScan.runPromise(async () => {
      EvFinderStatus.next({ status: FinderStatus.scanning });
      await resetScanBrake(paths, config);
      clsScan.update({
        limitPathSet: paths ? new Set(paths) : undefined,
        startConfig: config,
      });
      await doScan(config, ignoreCtime, false);
      if (await checkScanBrake(paths, config))
        EvUiCmdMessage.next({
          type: "warn",
          message: "Scan stopped manually.",
        });
      EvUiCmdMessage.next({
        type: "log",
        message: `Scan finished, cost ${
          Date.now() - clsScan.get().startAt.valueOf()
        }ms, context: ${config.finderRoot}.`,
      });
      EvFinderStatus.next({ status: FinderStatus.idle });
    });
  } else
    await switchDb(config, async () => {
      await getConnection();
      const scanPaths = await (async () => {
        let res = await await ScanPath.find();
        const clsValue = clsScan.get();
        if (clsValue.limitPathSet && clsValue.startConfig === config)
          res = res.filter((v) => clsValue.limitPathSet?.has(v.path));
        return res;
      })();
      scanPaths.forEach((v) =>
        EvFinderStatus.value.scanContextIdAndPathSet.add(
          getDbInfoId(config) + v.path
        )
      );
      EvFinderStatus.next(EvFinderStatus.value);
      if (config.isSubDb && !scanPaths.length) {
        scanPaths.push(new ScanPath("./"));
      }
      if (
        config.finderRoot !== Config.finderRoot &&
        scanPaths.find((v) => v.path !== "./") &&
        !scanPaths.find((v) => v.path === "./")
      ) {
        EvUiCmdMessage.next({
          type: "warn",
          message: `Only partial sub path will be scan in ${
            config.finderRoot
          }: ${scanPaths.map((v) => v.path).join(";")} `,
        });
      }
      EvUiCmdMessage.next({
        type: "log",
        message: `${scanPaths.length} path to scan.`,
      });
      for (const pathToScan of scanPaths) {
        pathToScan.lastMessage = "";
        const isPathToScanAbs = path.isAbsolute(pathToScan.path);
        const absPath = path.resolve(
          isPathToScanAbs
            ? pathToScan.path
            : path.join(config.finderRoot, pathToScan.path)
        );
        const mScanBrake = scanBrake || new BehaviorSubject<boolean>(false);
        const brakeSubscribe = cEvScanBrake.subscribe((brake) => {
          if (brake[path.resolve(absPath)]) {
            mScanBrake.next(true);
          }
        });
        EvUiCmdMessage.next({ type: "log", message: `Scan path: ${absPath}` });
        try {
          const pathPerm = pathPem.getPem(absPath);
          const pathScanStartAt = Date.now();
          if (!pathPerm.read) {
            throw new Error("Path to scan is no readable: " + absPath);
          } else if (isPathInclude(config.finderRoot, absPath)) {
            if (clsScan.get().Scaned.has(absPath)) {
              EvUiCmdMessage.next({
                type: "warn",
                message: "Skip scaned path: " + absPath,
              });
              continue;
            }

            const testDbPath = await testAndScanSubDb(
              absPath,
              ignoreCtime,
              config,
              currentDepth,
              mScanBrake
            );
            if (testDbPath) {
              pathToScan.dbPath = path.relative(config.finderRoot, testDbPath);
              await FileInfo.removePath(pathToScan.path);
            } else {
              clsScan.get().Scaned.add(absPath);
              errors = errors.concat(
                await scanPath(
                  pathToScan,
                  ignoreCtime,
                  config,
                  currentDepth,
                  mScanBrake
                )
              );
            }
          } else {
            EvUiCmdMessage.next({
              type: "log",
              message: "Switch to external scan path: " + absPath,
            });
            let dbPath = pathToScan.dbPath;
            if (!dbPath) {
              dbPath = pathToScan.dbPath = genExternalSubDbPath(pathToScan);
            }
            dbPath = joinToAbsolute(config.finderRoot, dbPath);
            const scanErrors = await doScan(
              {
                dbPath,
                dbName: config.dbName,
                finderRoot: absPath,
                readOnly: false,
                isSubDb: true,
              },
              false,
              ignoreCtime,
              currentDepth,
              undefined,
              mScanBrake
            );
            pathToScan.lastMessage = scanErrors.join("; \n");
          }
          pathToScan.lastScanedAt = new Date();
          if (mScanBrake.value)
            pathToScan.lastMessage = "Scanning is stopped manually.";
          else pathToScan.lastSuccessCost = Date.now() - pathScanStartAt;
          await pathToScan.save();
          if (mScanBrake.value) {
            EvUiCmdMessage.next({
              type: "warn",
              message: `Scan stopped manually: ${absPath}`,
            });
            continue;
          }
          EvUiCmdMessage.next({
            type: "log",
            message: `Path scan finished: ${absPath}`,
          });
        } catch (e) {
          pathToScan.lastMessage = String(e);
          pathToScan.lastScanedAt = new Date();
          await pathToScan.save().catch((e) => {
            EvLogError("Error: Save scan path failed: ", e);
          });
          EvUiCmdMessage.next({
            type: "error",
            message: `Scan path fail, path: ${absPath}, error: ${String(e)}`,
          });
          errors.push(`Scan path fail: ${absPath}:${e}`);
          if (isDev) {
            console.error(`Scan path fail: ${absPath}:${e}`, e.stack);
          }
        } finally {
          brakeSubscribe.unsubscribe();
          EvFinderStatus.value.scanContextIdAndPathSet.delete(
            getDbInfoId(config) + pathToScan.path
          );
          EvFinderStatus.next(EvFinderStatus.value);
        }
      }
    });
  return errors;
};

export const doScanCmd = async () => {
  const subscribe = EvUiCmdMessage.subscribe((msg) => {
    if (msg.type === "error") console.error(msg.message);
    if (msg.type === "warn") console.warn(msg.message);
    else console.log(msg.message);
  });
  await doScan();
  subscribe.unsubscribe();
};

export const genExternalSubDbPath = (scanPath: ScanPath) => {
  const config = getConfig();
  let dbPath = scanPath.dbPath;
  const absPath = joinToAbsolute(config.finderRoot, scanPath.path);
  const pathPerm = pathPem.getPem(absPath);
  const isPathToScanAbs = path.isAbsolute(scanPath.path);
  if (!dbPath) {
    const getRandomSubDatabaseName = () =>
      SUB_DATABASE_PREFIX +
      Math.random().toString(36).slice(2) +
      "-" +
      config.dbName;
    if (pathPerm.write) dbPath = path.join(absPath, config.dbName);
    else {
      while (!dbPath || fs.existsSync(dbPath)) {
        dbPath = path.join(config.finderRoot, getRandomSubDatabaseName());
      }
    }
    dbPath = isPathToScanAbs
      ? dbPath
      : path.relative(config.finderRoot, dbPath);
  }
  return dbPath;
};
