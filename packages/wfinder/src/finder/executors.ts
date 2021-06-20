import { getConnection } from "./db";
import { ScanPath } from "./entities/ScanPath";

export const exAddScanPath = async (scanPath: string) => {
    await getConnection();
    if (await ScanPath.count({ where: { path: scanPath } })){
      const error = `Path already exist: ${scanPath}`;
      return {error};
    }
    else {
     const result = await new ScanPath(scanPath).save();
     return {result};
    }
  };
  
  export const exDeleteScanPath = async (scanPath: string) => {
    await getConnection();
    const scanPaths = await ScanPath.find({ path: scanPath });
    if (!scanPaths.length){
      const error = `No path exist, you need to add path first.`;
      return {error};
    }
    else {
      const result = await ScanPath.remove(scanPaths);
      return {result:result[0]};
    }
  };
  
  export const exListScanPath = async () => {
    await getConnection();
    const scanPaths = await ScanPath.find();
    return {result: scanPaths};
  };