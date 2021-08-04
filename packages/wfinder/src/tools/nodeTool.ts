import { createHash } from "crypto";
import fs from "fs";
import os, { networkInterfaces } from "os";

export const exitNthTodo = () => exit("Nothing to do, program will exit now.");

export const exit = (reason: string) => {
  console.log(reason);
  process.exit();
};

export const genDbThumbnail = (dbPath: string) => {
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

export const getElectron = () => {
  try {
    return require("electron");
  } catch (e) {
    console.log("Failed to load electron:", e);
  }
};

export const isNodeElectron = () => {
  const electron = getElectron();
  return electron instanceof Object;
};

export const getIpAddressList = () => {
  let ipList: string[] = [];
  Object.entries(networkInterfaces()).forEach(([, info]) => {
    if (info) ipList = ipList.concat(info.map((v) => v.address));
  });
  return ipList;
};

export class TimeCouter {
  lastAt: [number, number];
  startAt: [number, number];
  constructor() {
    this.lastAt = this.startAt = process.hrtime();
  }
  count(msg = "") {
    const now = process.hrtime();
    console.log(
      (now[0] - this.lastAt[0]) * 1000000000 + (now[1] - this.lastAt[1]),
      msg
    );
    this.lastAt = now;
  }
  cost(msg = "") {
    const now = process.hrtime();
    console.log(
      (now[0] - this.startAt[0]) * 1000000000 + (now[1] - this.startAt[1]),
      msg
    );
  }
}
