import { spawn } from "child_process";
import path from "path";

export const startElectron = () => {
  // @ts-ignore
  const electron: string = require("electron");
  const proc = spawn(
    electron,
    [path.resolve(path.join(__dirname, "./electronMain"))],
    { stdio: "inherit", windowsHide: false }
  );

  (["SIGINT", "SIGTERM"] as NodeJS.Signals[]).forEach((signal) => {
    process.on(signal, () => {
      if (!proc.killed) proc.kill(signal);
    });
  });
};
