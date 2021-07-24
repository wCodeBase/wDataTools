import { exAddScanPath, exListScanPath } from "./executors";
import { getConfig, getConnection } from "./db";
import { FileInfo } from "./entities/FileInfo";
import path from "path";

export const addScanPath = async (scanPath: string) => {
  const res = await exAddScanPath(scanPath);
  if (res.error !== undefined) console.log(res.error);
  else console.log("ScanPath saved: ", res.result.path);
};

export const deleteScanPath = async (scanPath: string) => {
  const res = await exAddScanPath(scanPath);
  if (res.error !== undefined) console.log(res.error);
  else console.log("Scan path removed:", res.result.path);
};

export const listScanPath = async () => {
  const { result: scanPaths } = await exListScanPath();
  if (!scanPaths.length) {
    const error = `No path exist, you need to add path first.`;
    console.log(error);
  } else {
    console.log(
      "Scan paths: \n",
      scanPaths.map((v, i) => `(${i}): ${v.path}`).join("\n")
    );
  }
};

export const findFiles = async (keyWords: string[]) => {
  await getConnection();
  const total = await FileInfo.countByMatchName(keyWords, "", "");
  const fileInfos = await FileInfo.findByMatchName(keyWords, "", "", 50);
  if (!fileInfos.length) {
    console.log("No file found.");
    return;
  }
  const paths: string[] = [];
  const cwd = process.cwd();
  for (const info of fileInfos.slice(0, 100))
    paths.push(path.relative(cwd, info.absPath));
  console.log(
    `Search results(${total}): \n`,
    paths.map((v, i) => `(${i}): ${v}`).join("\n")
  );
  if (total >= 100) console.log("...");
};
