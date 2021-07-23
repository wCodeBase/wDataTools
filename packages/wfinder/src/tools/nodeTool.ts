import * as path from "path";
import { createHash } from "crypto";
import os from "os";
import fs from "fs";

export const exitNthTodo = () => exit("Nothing to do, program will exit now.");

export const exit = (reason: string) => {
  console.log(reason);
  process.exit();
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

export const pathPem = (() => {
  const { uid, gid } = os.userInfo();
  const getPem = (mode: number, pos: number) => ({
    exec: !!(mode & (1 << pos++)),
    write: !!(mode & (1 << pos++)),
    read: !!(mode & (1 << pos++)),
  });
  const genGetOnePem = (shift: number) => (path: string, stats?: fs.Stats) => {
    const _stats: Partial<fs.Stats> & { mode: number } =
      stats || fs.existsSync(path) ? fs.statSync(path) : { mode: 0 };
    const pos = uid === _stats.uid ? 6 : 0;
    let res = _stats.mode & (1 << (pos + shift));
    if (gid === _stats.gid) {
      res = res || _stats.mode & (1 << (3 + shift));
    }
    return res;
  };
  return {
    getPem: (path: string, stats?: fs.Stats) => {
      const _stats: Partial<fs.Stats> & { mode: number } =
        stats || fs.existsSync(path) ? fs.statSync(path) : { mode: 0 };
      const mode = _stats.mode;
      const pos = uid === _stats.uid ? 6 : 0;
      const res = getPem(mode, pos);
      if (gid === _stats.gid) {
        (
          Object.entries(getPem(mode, 3)) as [keyof typeof res, boolean][]
        ).forEach(([k, v]) => (res[k] = res[k] || v));
      }
      return res;
    },
    canExec: genGetOnePem(0),
    canWrite: genGetOnePem(1),
    canRead: genGetOnePem(2),
  };
})();
