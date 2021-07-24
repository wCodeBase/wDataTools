import { randomInt } from "crypto";
import path from "path";
import { fse } from "./imports";

export const randomPick = <T>(data: T[]) => {
  return data[randomInt(0, data.length)];
};

export const ensureJsFile = (filePath: string) => {
  if (!fse.existsSync(filePath)) {
    const info = path.parse(filePath);
    const ext =
      (info.ext.slice(0, 2) === "ts"
        ? "j"
        : info.ext.slice(0, 2) === "js"
        ? "t"
        : info.ext.slice(0, 1)) + info.ext.slice(1);
    return filePath.slice(0, -info.ext.length) + ext;
  }
  return filePath;
};
