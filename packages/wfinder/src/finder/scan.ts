import { Config } from "./common";
import * as path from "path";
import * as fs from "fs";
import { isPathInclude, splitPath } from "../tools/tool";
import { FileInfo, FileType } from "./entities/FileInfo";
import { getConnection } from "./db";
import { ScanPath } from "./entities/ScanPath";
import { EvFinderState, EvUiCmMessage } from "./events/events";
import { FinderState } from "./events/types";

export class FileScanError extends Error { }

export const scanPath = async (scanPath: string, ignoreCtime = false, config = Config) => {
  scanPath = path.resolve(scanPath);
  const { finderRoot } = config;
  if (!fs.existsSync(scanPath))
    throw new FileScanError("Path to scan is not exist.");
  if (!isPathInclude(finderRoot, scanPath))
    throw new FileScanError("Path to scan is not included in finderRoot.");

  let parentId = -1;
  const pathSegs = splitPath(path.relative(finderRoot, scanPath));
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

  if (fs.statSync(scanPath).isFile()) {
    const fileInfo = await FileInfo.findOne(parentId);
    if (!fileInfo)
      throw new FileScanError(
        "ScanPath segements generate error, scanPath is file but no fileInfo created."
      );
    fileInfo.type = FileType.file;
    fileInfo.size = fs.statSync(scanPath).size;
    await fileInfo.save();
    return;
  }
  const scanStack: { id: number; absPath: string; restChildren: string[], ctime: Date }[] = [
    { id: parentId, absPath: scanPath, restChildren: fs.readdirSync(scanPath), ctime: fs.statSync(scanPath).ctime },
  ];
  while (shouldScan) {
    const item = scanStack.pop();
    if (!item) break;
    for (const name of item.restChildren) {
      const chilPath = path.join(item.absPath, name);
      const stat = fs.statSync(chilPath);
      if (stat.isFile())
        await FileInfo.getOrInsert(name, FileType.file, stat.ctime, item.id, stat.size);
      else {
        const info = await FileInfo.getOrInsert(name, FileType.folder, stat.ctime, item.id);
        if (ignoreCtime || info.ctime.valueOf() !== stat.ctime.valueOf()) {
          scanStack.push({
            id: info.id,
            absPath: chilPath,
            restChildren: fs.readdirSync(chilPath),
            ctime: stat.ctime,
          });
        }
      }
    }
    if (shouldScan) {
      const info = await FileInfo.findOne(item.id);
      if (info && info.ctime.valueOf() !== item.ctime.valueOf()) {
        info.ctime = item.ctime;
        await info.save();
      }
    }
  }
};

let shouldScan = false;

export const stopScan = () => {
  shouldScan = false;
}

export const doScan = async () => {
  EvFinderState.next(FinderState.scanning);
  shouldScan = true;
  await getConnection();
  const scanPaths = await ScanPath.find();
  EvUiCmMessage.next({ message: `${scanPaths.length} path to scan.` });
  for (const path of scanPaths) {
    EvUiCmMessage.next({ message: `Scan path: ${path.path}` });
    try {
      await scanPath(path.path);
      path.lastScanedAt = new Date();
      await path.save();
      EvUiCmMessage.next({ message: `Path scan finished: ${path.path}` });
    } catch (e) {
      EvUiCmMessage.next({ message: `Scan path fail: ${path.path}\n`, error: String(e) });
    }
  }
  EvUiCmMessage.next({ message: "Scan finished." });
  shouldScan = false;
  EvFinderState.next(FinderState.idle);
}

export const doScanCmd = async () => {
  const subscribe = EvUiCmMessage.subscribe(msg => {
    if (msg.error) console.error(msg.message, msg.error);
    else console.log(msg.message);
  });
  await doScan();
  subscribe.unsubscribe();
};
