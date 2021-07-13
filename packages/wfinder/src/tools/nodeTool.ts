import * as path from "path";
import { createHash } from "crypto";
import os from "os";
import fs from "fs";

export const exitNthTodo = () => exit("Nothing to do, program will exit now.");

export const exit = (reason: string) => {
  console.log(reason);
  process.exit();
};

export const isPathInclude = (absParentPath: string, absSubPath: string) =>
  path.relative(absParentPath, absSubPath).slice(0, 2) !== "..";

export const splitPath = (pathStr: string) => {
  const paths: string[] = [];
  let rest = pathStr;
  while (rest) {
    const parsed = path.parse(rest);
    if (!parsed.base) {
      if (rest) paths.unshift(rest);
      break;
    }
    paths.unshift(parsed.base);
    rest = parsed.dir;
  }
  return paths;
};

export const genDbThumnail = (dbPath: string) => {
  const hash = createHash("sha256");
  hash.update(Date.now().toString());
  hash.update(
    JSON.stringify([
      os.arch(),
      os.cpus(),
      os.freemem(),
      os.homedir(),
      os.hostname(),
      os.networkInterfaces(),
      os.platform(),
      os.release(),
    ])
  );
  hash.update(dbPath);
  const buffer = hash.digest();
  const numbers: number[] = [];
  while (numbers.length * 4 < buffer.length) {
    numbers.push(buffer.readUInt32BE(numbers.length * 4));
  }
  return numbers.map((v) => v.toString(36)).join("");
};

export const getPathPermission = (path: string) => {
  const mode = fs.existsSync(path) ? fs.statSync(path).mode : 0;
  return {
    read: !!(mode & (1 << 8)),
    write: !!(mode & (1 << 7)),
    exec: !!(mode & (1 << 6)),
  };
};
