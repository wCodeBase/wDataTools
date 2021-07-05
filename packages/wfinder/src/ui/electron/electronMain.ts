import {
  switchEvent,
  GATEWAY_CHANNEL,
} from "./../../finder/events/eventGateway";
import { isDev, htmlFileRoot, loadHtml } from "./common";
import { app, BrowserWindow } from "electron";

app.whenReady().then(() => {
  const win = new BrowserWindow({
    // width: 500,
    // height: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.webContents.openDevTools();
  const gateway = switchEvent((data) =>
    win.webContents.send(GATEWAY_CHANNEL, data)
  );
  win.webContents.addListener("ipc-message", (ev, channel, data) => {
    if (channel === GATEWAY_CHANNEL) gateway.receive(data);
  });
  win.addListener("close", () => gateway.unsubscribe());
  loadHtml(win);
});
