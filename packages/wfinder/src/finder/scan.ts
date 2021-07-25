import { interactYield } from "./../tools/tool";
import { ConfigLine } from "./entities/ConfigLine";
import { cEvScanBrake } from "./events/core/coreEvents";
import { Config, MAX_PATH_DEPTH } from "./common";
import * as path from "path";
import * as fs from "fs";
import { pathPem } from "../tools/nodeTool";
import {
  isPathEqual,
  isPathInclude,
  joinToAbsolute,
  splitPath,
} from "../tools/pathTool";
import { FileInfo, processText } from "./entities/FileInfo";
import { switchDb, getConnection, getConfig } from "./db";
import { ScanPath } from "./entities/ScanPath";
import { EvFinderStatus, EvUiCmdMessage } from "./events/events";
import { FinderStatus } from "./events/types";
import { DbIncluded } from "./entities/DbIncluded";
import { ConfigLineType, FileType, getDbInfoId } from "./types";
import { createNamespace, getNamespace } from "cls-hooked";
import { SUB_DATABASE_PREFIX } from "../constants";

export class FileScanError extends Error {}

export const scanPath = async (
  pathOrScanPath: string | ScanPath,
  ignoreCtime = false,
  config = Config,
  currentDepth = 0
) => {
  return await switchDb(config, async (): Promise<string[]> => {
    const errors: string[] = [];
    const pathToScan = joinToAbsolute(
      config.finderRoot,
      pathOrScanPath instanceof ScanPath ? pathOrScanPath.path : pathOrScanPath
    );
    const { finderRoot } = config;
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
      return errors;
    }
    const testAndScanSubDb = async (
      testAbsPath: string,
      currentDepth: number
    ) => {
      if (isPathEqual(testAbsPath, config.finderRoot)) return false;
      const testDbPath = path.join(testAbsPath, config.dbName);
      if (
        fs.existsSync(testDbPath) &&
        fs.statSync(testDbPath).isFile() &&
        pathPem.canWrite(testDbPath)
      ) {
        EvUiCmdMessage.next({
          message: `Sub database found: ${testDbPath}`,
        });
        await DbIncluded.remove(
          (
            await DbIncluded.find()
          ).filter((v) =>
            isPathInclude(
              testAbsPath,
              joinToAbsolute(v.dbInfo.finderRoot, v.path)
            )
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
          currentDepth + 1
        );
        return testDbPath;
      }
      return false;
    };
    const testDbPath = await testAndScanSubDb(pathToScan, currentDepth);
    if (testDbPath) {
      await FileInfo.removeChildren(parentId);
      if (pathOrScanPath instanceof ScanPath) {
        pathOrScanPath.dbPath = path.relative(config.finderRoot, testDbPath);
        await pathOrScanPath.save();
      }
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

      while (!cEvScanBrake.value) {
        const item = scanStack.pop();
        if (!item) break;
        if (item.depth > MAX_PATH_DEPTH) {
          EvUiCmdMessage.next({
            error: `Reach max path depth(${MAX_PATH_DEPTH}): ${item.absPath}`,
          });
          break;
        }
        await FileInfo.removeUnexistChildren(
          item.id,
          item.restChildren,
          cEvScanBrake
        );
        for (const name of item.restChildren) {
          const excludeType = judgeExcludeType(name);
          if (excludeType === ExcludeType.current) {
            await FileInfo.removeChildren(item.id, [name], cEvScanBrake);
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
                await FileInfo.find({
                  where: { parentId: item.id, name: processText(name) },
                })
              )[0]?.ctime.valueOf() !== stat.ctime.valueOf();
            const info = await FileInfo.getOrInsert(
              name,
              FileType.folder,
              stat.ctime,
              item.id
            );
            if (excludeType === ExcludeType.children) {
              FileInfo.removeChildren(info.id, undefined, cEvScanBrake);
            } else if (!pathPem.canRead(chilPath)) {
              errors.push(`Path unreadable: ${chilPath}`);
            } else {
              if (!(await testAndScanSubDb(chilPath, item.depth))) {
                scanStack.push({
                  id: info.id,
                  absPath: chilPath,
                  restChildren: fs.readdirSync(chilPath),
                  ctime: stat.ctime,
                  changed,
                  depth: item.depth + 1,
                });
              }
            }
          }
          if (cEvScanBrake.value) break;
          await interactYield();
        }
        if (!cEvScanBrake.value) {
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

export const stopScan = () => {
  cEvScanBrake.next(true);
};

const clsScan = (() => {
  const cls = createNamespace("clsScan");
  const clsVarKey = "scanVars";
  const genScanVars = () => {
    return {
      startAt: new Date(),
      Scaned: new Set<string>(),
      limitPathSet: undefined as Set<string> | undefined,
      startConfig: getConfig(),
    };
  };
  const defaultScanVar = genScanVars();
  return {
    runPromise: cls.runPromise.bind(cls),
    update(values?: Partial<typeof defaultScanVar>) {
      const toSet = genScanVars();
      if (values) Object.assign(toSet, values);
      cls.set(clsVarKey, toSet);
    },
    get(): typeof defaultScanVar {
      return cls.get(clsVarKey) || defaultScanVar;
    },
  };
})();

export const doScan = async (
  config = getConfig(),
  isScanRoot = true,
  ignoreCtime = false,
  currentDepth = 0,
  paths?: string[]
) => {
  let errors: string[] = [];
  if (isScanRoot) {
    await clsScan.runPromise(async () => {
      EvFinderStatus.next({ status: FinderStatus.scanning });
      cEvScanBrake.next(false);
      clsScan.update({
        limitPathSet: paths ? new Set(paths) : undefined,
        startConfig: config,
      });
      await doScan(config, ignoreCtime, false);
      if (cEvScanBrake.value)
        EvUiCmdMessage.next({ message: "Scan stopped manually." });
      EvUiCmdMessage.next({
        message: `Scan finished, cost ${
          Date.now() - clsScan.get().startAt.valueOf()
        }ms, context: ${JSON.stringify(config)}.`,
      });
      cEvScanBrake.next(true);
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
        scanPaths.find((v) => v.path !== "./") &&
        !scanPaths.find((v) => v.path === "./")
      ) {
        EvUiCmdMessage.next({
          warn: `Only partial sub path will be scan in ${
            config.finderRoot
          }: ${scanPaths.map((v) => v.path).join(";")} `,
        });
      }
      EvUiCmdMessage.next({ message: `${scanPaths.length} path to scan.` });
      for (const pathToScan of scanPaths) {
        pathToScan.lastMessage = "";
        const isPathToScanAbs = path.isAbsolute(pathToScan.path);
        const absPath = isPathToScanAbs
          ? pathToScan.path
          : path.join(config.finderRoot, pathToScan.path);
        EvUiCmdMessage.next({ message: `Scan path: ${absPath}` });
        try {
          const pathPerm = pathPem.getPem(absPath);
          if (!pathPerm.read) {
            throw new Error("Path to scan is no readable: " + absPath);
          } else if (isPathInclude(config.finderRoot, absPath)) {
            if (clsScan.get().Scaned.has(absPath)) {
              EvUiCmdMessage.next({ warn: "Skip scaned path: " + absPath });
              continue;
            }
            clsScan.get().Scaned.add(absPath);
            errors = errors.concat(
              await scanPath(pathToScan, ignoreCtime, config, currentDepth)
            );
          } else {
            let dbPath = pathToScan.dbPath;
            if (!dbPath) {
              dbPath = pathToScan.dbPath = genExternalSubDbPath(pathToScan);
            }
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
              currentDepth
            );
            pathToScan.lastMessage = scanErrors.join("; \n");
          }
          pathToScan.lastScanedAt = new Date();
          await pathToScan.save();
          EvUiCmdMessage.next({ message: `Path scan finished: ${absPath}` });
          if (cEvScanBrake.value) break;
        } catch (e) {
          pathToScan.lastMessage = String(e);
          pathToScan.lastScanedAt = new Date();
          await pathToScan.save().catch((e) => {
            console.log("Save scan path failed: ", e);
          });
          EvUiCmdMessage.next({
            message: `Scan path fail: ${absPath}`,
            error: String(e),
          });
          errors.push(`Scan path fail: ${absPath}:${e}`);
        } finally {
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
    if (msg.error) console.error(msg.message, msg.error);
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
