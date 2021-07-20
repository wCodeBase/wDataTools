import { interactYield } from "./../tools/tool";
import { ConfigLine } from "./entities/ConfigLine";
import { cEvScanBrake } from "./events/core/coreEvents";
import { Config, MAX_PATH_DEPTH } from "./common";
import * as path from "path";
import * as fs from "fs";
import {
  getPathPermission,
  isPathEqual,
  isPathInclude,
  joinToAbsolute,
  splitPath,
} from "../tools/nodeTool";
import { FileInfo } from "./entities/FileInfo";
import { switchDb, getConnection, getConfig } from "./db";
import { ScanPath } from "./entities/ScanPath";
import { EvFinderStatus, EvUiCmdMessage } from "./events/events";
import { FinderStatus } from "./events/types";
import { DbIncluded } from "./entities/DbIncluded";
import { ConfigLineType, FileType } from "./types";
import { createNamespace, getNamespace } from "cls-hooked";

export class FileScanError extends Error {}

export const scanPath = async (
  pathToScan: string,
  ignoreCtime = false,
  config = Config,
  currentDepth = 0
) => {
  await switchDb(config, async () => {
    pathToScan = joinToAbsolute(config.finderRoot, pathToScan);
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
      return;
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
        getPathPermission(testDbPath).write
      ) {
        EvUiCmdMessage.next({
          message: `Sub database found: ${testDbPath}`,
        });
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
        return true;
      }
      return false;
    };
    if (await testAndScanSubDb(pathToScan, currentDepth)) {
      await FileInfo.removeChildren(parentId);
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
                await FileInfo.find({ where: { parentId: item.id, name } })
              )[0]?.ctime.valueOf() !== stat.ctime.valueOf();
            const info = await FileInfo.getOrInsert(
              name,
              FileType.folder,
              stat.ctime,
              item.id
            );
            if (excludeType === ExcludeType.children) {
              FileInfo.removeChildren(info.id, undefined, cEvScanBrake);
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
  });
};

export const stopScan = () => {
  cEvScanBrake.next(true);
};

const clsScanedPathSet = (() => {
  const cls = createNamespace("ScanedPathSet");
  const clsKey = "scanedPathSet";
  return {
    runPromise: cls.runPromise.bind(cls),
    has(key: string) {
      return !!cls.get(clsKey)?.has(key);
    },
    add(key: string) {
      cls.get(clsKey)?.add(key);
    },
    update() {
      cls.set(clsKey, new Set());
    },
  };
})();

export const doScan = async (
  config = getConfig(),
  isScanRoot = true,
  ignoreCtime = false,
  currentDepth = 0
) => {
  if (isScanRoot) {
    EvFinderStatus.next(FinderStatus.scanning);
    cEvScanBrake.next(false);
    await clsScanedPathSet.runPromise(async () => {
      clsScanedPathSet.update();
      await doScan(config, ignoreCtime, false);
    });
    if (cEvScanBrake.value)
      EvUiCmdMessage.next({ message: "Scan stopped manually." });
    EvUiCmdMessage.next({ message: "Scan finished." });
    cEvScanBrake.next(true);
    EvFinderStatus.next(FinderStatus.idle);
  } else
    await switchDb(config, async () => {
      await getConnection();
      const scanPaths = await ScanPath.find();
      if (config.isSubDb && !scanPaths.length) {
        scanPaths.push(new ScanPath("./"));
      }
      EvUiCmdMessage.next({ message: `${scanPaths.length} path to scan.` });
      for (const pathToScan of scanPaths) {
        const isPathToScanAbs = path.isAbsolute(pathToScan.path);
        const absPath = isPathToScanAbs
          ? pathToScan.path
          : path.join(config.finderRoot, pathToScan.path);
        EvUiCmdMessage.next({ message: `Scan path: ${absPath}` });
        try {
          const pathPerm = getPathPermission(absPath);
          if (!pathPerm.read) {
            const error = "Path to scan is no readable: " + absPath;
            EvUiCmdMessage.next({ error });
            pathToScan.lastScanError = error;
          } else if (isPathInclude(config.finderRoot, absPath)) {
            if (clsScanedPathSet.has(absPath)) {
              EvUiCmdMessage.next({ warn: "Skip scaned path: " + absPath });
              continue;
            }
            clsScanedPathSet.add(absPath);
            await scanPath(pathToScan.path, ignoreCtime, config, currentDepth);
          } else {
            let dbPath = pathToScan.dbPath;
            if (!dbPath) {
              dbPath = path.join(
                pathPerm.write ? absPath : config.finderRoot,
                config.dbName
              );
              pathToScan.dbPath = isPathToScanAbs
                ? dbPath
                : path.relative(config.finderRoot, dbPath);
            }
            const dbName = path.parse(dbPath).name;
            await doScan(
              {
                dbPath,
                dbName,
                finderRoot: absPath,
                readOnly: false,
                isSubDb: true,
              },
              false,
              ignoreCtime,
              currentDepth
            );
          }
          if (cEvScanBrake.value) break;
          pathToScan.lastScanedAt = new Date();
          await pathToScan.save();
          EvUiCmdMessage.next({ message: `Path scan finished: ${absPath}` });
        } catch (e) {
          EvUiCmdMessage.next({
            message: `Scan path fail: ${absPath}\n`,
            error: String(e),
          });
        }
      }
    });
};

export const doScanCmd = async () => {
  const subscribe = EvUiCmdMessage.subscribe((msg) => {
    if (msg.error) console.error(msg.message, msg.error);
    else console.log(msg.message);
  });
  await doScan();
  subscribe.unsubscribe();
};
