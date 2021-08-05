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

export const joinPropertyPath = (...paths: string[]) => {
  return paths
    .filter((v) => v)
    .map((v) => v.replace(/^\./, "").replace(/\.$/, ""))
    .join(".");
};

export const traverseObject = (
  data: any,
  callback: (v: any, path: string) => void,
  parentPath = ""
) => {
  if (data instanceof Array) {
    data.forEach((v, index) =>
      traverseObject(v, callback, joinPropertyPath(parentPath, index + ""))
    );
  } else if (data instanceof Object) {
    Object.entries(data).forEach(([key, v]) =>
      traverseObject(v, callback, joinPropertyPath(parentPath, key))
    );
  } else {
    callback(data, parentPath);
  }
};
