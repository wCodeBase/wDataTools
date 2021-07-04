import { cEvScanBrake } from "./events/coreEvents";
import { Config } from "./common";
import * as path from "path";
import * as fs from "fs";
import { interactYield, isPathInclude, splitPath } from "../tools/tool";
import { FileInfo, FileType } from "./entities/FileInfo";
import { switchDb, getConnection } from "./db";
import { ScanPath } from "./entities/ScanPath";
import { EvFinderState, EvUiCmdMessage } from "./events/events";
import { FinderState } from "./events/types";
import { DbIncluded } from "./entities/DbIncluded";

export class FileScanError extends Error {}

export const scanPath = async (
  pathToScan: string,
  ignoreCtime = false,
  config = Config
) => {
  await switchDb(config, async () => {
    pathToScan = path.resolve(pathToScan);
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
    const scanStack = [
      {
        id: parentId,
        absPath: pathToScan,
        restChildren: fs.readdirSync(pathToScan),
        ctime: fs.statSync(pathToScan).ctime,
        changed: true,
      },
    ];
    while (!cEvScanBrake.value) {
      const item = scanStack.pop();
      if (!item) break;
      await FileInfo.removeUnexistChildren(
        item.id,
        item.restChildren,
        cEvScanBrake
      );
      for (const name of item.restChildren) {
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
          const testDbPath = path.join(chilPath, config.dbName);
          if (fs.existsSync(testDbPath) && fs.statSync(testDbPath).isFile()) {
            EvUiCmdMessage.next({
              message: `Sub database found: ${testDbPath}`,
            });
            await DbIncluded.mark(
              path.relative(config.finderRoot, chilPath),
              config.dbName
            );
            await scanPath(chilPath, ignoreCtime, {
              ...config,
              dbPath: testDbPath,
              finderRoot: chilPath,
            });
          } else
            scanStack.push({
              id: info.id,
              absPath: chilPath,
              restChildren: fs.readdirSync(chilPath),
              ctime: stat.ctime,
              changed,
            });
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

    await DbIncluded.removeUnexists();
  });
};

export const stopScan = () => {
  cEvScanBrake.next(true);
};

export const doScan = async () => {
  EvFinderState.next(FinderState.scanning);
  cEvScanBrake.next(false);
  await getConnection();
  const scanPaths = await ScanPath.find();
  EvUiCmdMessage.next({ message: `${scanPaths.length} path to scan.` });
  for (const path of scanPaths) {
    EvUiCmdMessage.next({ message: `Scan path: ${path.path}` });
    try {
      await scanPath(path.path);
      path.lastScanedAt = new Date();
      await path.save();
      EvUiCmdMessage.next({ message: `Path scan finished: ${path.path}` });
    } catch (e) {
      EvUiCmdMessage.next({
        message: `Scan path fail: ${path.path}\n`,
        error: String(e),
      });
    }
  }
  if (cEvScanBrake.value)
    EvUiCmdMessage.next({ message: "Scan stopped manually." });
  EvUiCmdMessage.next({ message: "Scan finished." });
  cEvScanBrake.next(true);
  EvFinderState.next(FinderState.idle);
};

export const doScanCmd = async () => {
  const subscribe = EvUiCmdMessage.subscribe((msg) => {
    if (msg.error) console.error(msg.message, msg.error);
    else console.log(msg.message);
  });
  await doScan();
  subscribe.unsubscribe();
};
