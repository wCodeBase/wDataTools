import { Config } from "./common";
import * as path from "path";
import * as fs from "fs";
import { isPathInclude, splitPath } from "../tools/tool";
import { FileInfo, FileType } from "./entities/FileInfo";
import { getConnection } from "./db";
import { ScanPath } from "./entities/ScanPath";

export class FileScanError extends Error {}

export const scanPath = async (scanPath: string, config = Config) => {
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
  const scanStack: { id: number; absPath: string; restChildren: string[] }[] = [
    { id: parentId, absPath: scanPath, restChildren: fs.readdirSync(scanPath) },
  ];
  while (true) {
    const item = scanStack.pop();
    if (!item) break;
    for (const name of item.restChildren) {
      const chilPath = path.join(item.absPath, name);
      const stat = fs.statSync(chilPath);
      if (stat.isFile())
        await FileInfo.getOrInsert(name, FileType.file, item.id, stat.size);
      else {
        const info = await FileInfo.getOrInsert(name, FileType.folder, item.id);
        scanStack.push({
          id: info.id,
          absPath: chilPath,
          restChildren: fs.readdirSync(chilPath),
        });
      }
    }
  }
};

export const doScanCmd = async () => {
  await getConnection();
  const scanPaths = await ScanPath.find();
  console.log(`${scanPaths.length} path to scan.`);
  for (const path of scanPaths) {
    console.log(`Scan path: ${path.path}`);
    try {
      await scanPath(path.path);
      path.lastScanedAt = new Date();
      await path.save();
      console.log(`Path scan finished: ${path.path}`);
    } catch (e) {
      console.error(`Scan path fail: ${path.path}\n`, e);
    }
  }
  console.log("Scan finished.");
};
