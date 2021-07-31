import { spawn } from "child_process";
import path from "path";
import { initFinder } from "../../finder";
import { EvUiLaunched } from "../../finder/events/events";
import { getElectron } from "../../tools/nodeTool";
import { execRoot } from "./../../env";
import { startIpcServer, USE_IPC_SERVER } from "./ipcServer";

export const startElectron = async () => {
  const electron = getElectron();
  if (typeof electron === "string") {
    EvUiLaunched.next({ electron: true });
    initFinder();
    const {
      token,
      address: { port, address },
      server,
    } = await startIpcServer();
    const proc = spawn(
      electron,
      [
        path.resolve(path.join(execRoot, "electronMain")),
        USE_IPC_SERVER,
        String(port),
        address,
        token,
      ],
      { stdio: "inherit", windowsHide: false }
    );

    proc.on("exit", (code) => {
      server.close();
      process.exit(code || undefined);
    });

    (["SIGINT", "SIGTERM"] as NodeJS.Signals[]).forEach((signal) => {
      process.on(signal, () => {
        if (!proc.killed) proc.kill(signal);
      });
    });

    process.on("exit", () => {
      if (!proc.killed) proc.kill();
    });
  } else if (electron instanceof Object) {
    require("../../electronMain");
  } else {
    console.warn("Electron not found, failed to launch wfinder gui.");
  }
};
