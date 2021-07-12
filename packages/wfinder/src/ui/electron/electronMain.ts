import { getUserPreference, setUserPreference } from "./preference";
import { USE_IPC_SERVER } from "./ipcServer";
import { switchEvent } from "./../../finder/events/eventGateway";
import { loadHtml } from "./common";
import { app, BrowserWindow, Menu } from "electron";
import { initFinder } from "../../finder";
import net from "net";
import { packetTool } from "../../tools/streamTool";
import {
  TypeGateway,
  GATEWAY_CHANNEL,
  CLIENT_READY,
} from "../../finder/events/eventTools";
import { throttle } from "lodash";

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
          `Failed to parse ipcServer data from server: ${socket.address()}`,
          e
        );
      }
    });
    socket.on("close", () => {
      gateway?.unsubscribe();
    });
  } else initFinder();
})();

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  const preference = getUserPreference();
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
    const [windowWidth, windowHeight] = win.getSize();
    const { x, y } = win.getBounds();
    setUserPreference({ windowWidth, windowHeight, windowX: x, windowY: y });
  }, 500);
  win.addListener("resize", updateWindowPreference);
  win.addListener("move", updateWindowPreference);
  win.addListener(
    "maximize",
    throttle(() => {
      setUserPreference({ maximize: true });
    }, 500)
  );
  win.webContents.openDevTools();
  (() => {
    let clientReady = false;
    let gateway: TypeGateway | undefined;
    win.webContents.addListener("ipc-message", (ev, channel, data) => {
      if (channel === GATEWAY_CHANNEL) {
        if (data === CLIENT_READY) {
          if (clientReady) gateway?.unsubscribe();
          gateway = switchEvent((data) => {
            win.webContents.send(GATEWAY_CHANNEL, data);
          }, true);
          clientReady = true;
        } else {
          gateway?.receive(data);
        }
      }
    });
    win.addListener("close", () => gateway?.unsubscribe());
  })();
  loadHtml(win);
});
