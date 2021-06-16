import { getConnection } from "./db";
import { FileInfo } from "./entities/FileInfo";
import { ScanPath } from "./entities/ScanPath";

export const addScanPath = async (scanPath: string) => {
  await getConnection();
  if (await ScanPath.count({ where: { path: scanPath } }))
    console.log(`Path already exist: ${scanPath}`);
  else {
    await new ScanPath(scanPath).save();
    console.log("ScanPath saved: ", scanPath);
  }
};

export const deleteScanPath = async (scanPath: string) => {
  await getConnection();
  const scanPaths = await ScanPath.find({ path: scanPath });
  if (!scanPaths.length) console.log(`Path dose not exist`);
  else {
    await ScanPath.remove(scanPaths);
    console.log("Scan path removed:", scanPaths.map((v) => v.path).join(", "));
  }
};

export const listScanPath = async () => {
  await getConnection();
  const scanPaths = await ScanPath.find();
  if (!scanPaths.length) console.log(`No path exists`);
  else {
    console.log(
      "Scan paths: \n",
      scanPaths.map((v, i) => `(${i}): ${v.path}`).join("\n")
    );
  }
};

export const findFiles = async (keyWords: string[]) => {
  await getConnection();
  const fileInfos = await FileInfo.findByMatchName(keyWords.join(" "));
  if (!fileInfos.length) {
    console.log("No file found.");
    return;
  }
  const paths: string[] = [];
  for (const info of fileInfos.slice(0, 100)) paths.push(await info.getPath());
  console.log(
    `Search results(${fileInfos.length}): \n`,
    paths.map((v, i) => `(${i}): ${v}`).join("\n")
  );
  if (fileInfos.length > 100) console.log("...");
};
