import { app, Menu, dialog, BrowserWindow } from "electron";
import { throttle } from "lodash";
import path from "path";
import { APP_DATA_FOLDER_NAME } from "./constants";
import { initFinder } from "./finder";
import { isDev } from "./finder/common";
import { switchEvent } from "./finder/events/eventGateway";
import {
  EvUiCmd,
  EvUiCmdResult,
  EvFinderState,
  EvUiLaunched,
} from "./finder/events/events";
import {
  TypeGateway,
  GATEWAY_CHANNEL,
  CLIENT_READY,
} from "./finder/events/eventTools";
import { packetTool } from "./tools/streamTool";
import { loadHtml } from "./ui/electron/common";
import { USE_IPC_SERVER } from "./ui/electron/ipcServer";
import { getUserPreference, setUserPreference } from "./ui/electron/preference";
import net from "net";

EvUiCmd.subscribe((msg) => {
  if (msg?.cmd === "queryUserDataDir") {
    EvUiCmdResult.next({
      cmd: "queryUserDataDir",
      tag: msg.tag,
      result: path.join(app.getPath("appData"), APP_DATA_FOLDER_NAME),
    });
  }
});

Menu.setApplicationMenu(null);

app.whenReady().then(async () => {
  EvUiCmd.subscribe(async (msg) => {
    if (msg?.cmd === "requestPickLocalPath") {
      const cwd = msg.data.cwd || process.cwd();
      const res = await dialog.showOpenDialog(win, {
        defaultPath: cwd,
        title: msg.data.title,
        properties: ["openDirectory", ...(msg.data.properties || [])],
      });
      if (msg.data.toShotestAbsOrRel) {
        const fRoot =
          (msg.context || EvFinderState.value.config)?.finderRoot || cwd;
        res.filePaths = res.filePaths.map((v) => {
          const relative = path.relative(fRoot, v);
          if (relative.length < v.length) return relative || "./";
          return v;
        });
      }
      EvUiCmdResult.next({
        cmd: "requestPickLocalPath",
        tag: msg.tag,
        result: { path: res.filePaths[0] },
      });
    }
  });

  (() => {
    const [tag, port, address, token] = process.argv.slice(2);
    if (tag === USE_IPC_SERVER) {
      const socket = net.createConnection(Number(port), address);
      socket.setNoDelay(true);
      let gateway: TypeGateway | undefined;
      socket.on("connect", () => {
        socket.write(token);
        gateway = switchEvent(
          (data) => socket.write(packetTool.wrapData(data)),
          false
        );
      });
      const dataCache: Buffer[] = [];
      socket.on("data", (data) => {
        try {
          if (!gateway) dataCache.push(data);
          else {
            let cached = dataCache.shift();
            while (cached) {
              packetTool
                .parseData(cached)
                .forEach((data) => gateway?.receive(String(data)));
              cached = dataCache.shift();
            }
            packetTool
              .parseData(data)
              .forEach((data) => gateway?.receive(String(data)));
          }
        } catch (e) {
          console.log(
            `Failed to parse ipcServer data from server: ${JSON.stringify(
              socket.address()
            )}`,
            e
          );
        }
      });
      socket.on("close", () => {
        gateway?.destory();
      });
    } else {
      EvUiLaunched.next({ electron: true });
      initFinder();
    }
  })();

  const preference = await getUserPreference();
  const win = new BrowserWindow({
    width: preference.windowWidth,
    height: preference.windowHeight,
    x: preference.windowX,
    y: preference.windowY,
    minWidth: 500,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  if (preference.maximize) win.maximize();
  const updateWindowPreference = throttle(() => {
    if (win.isMaximized()) {
      setUserPreference({ maximize: true });
    } else {
      const [windowWidth, windowHeight] = win.getSize();
      const { x, y } = win.getBounds();
      setUserPreference({
        windowWidth,
        windowHeight,
        windowX: x,
        windowY: y,
        maximize: false,
      });
    }
  }, 500);
  win.addListener("resize", updateWindowPreference);
  win.addListener("move", updateWindowPreference);
  win.addListener("maximize", updateWindowPreference);
  if (isDev) win.webContents.openDevTools();
  (() => {
    let clientReady = false;
    let gateway: TypeGateway | undefined;
    win.webContents.addListener("ipc-message", (ev, channel, data) => {
      if (channel === GATEWAY_CHANNEL) {
        if (data === CLIENT_READY) {
          if (clientReady) gateway?.destory();
          gateway = switchEvent((data) => {
            win.webContents.send(GATEWAY_CHANNEL, data);
          }, true);
          clientReady = true;
        } else {
          gateway?.receive(data);
        }
      }
    });
    win.addListener("close", () => gateway?.destory());
  })();
  loadHtml(win);
});
