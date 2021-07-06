import {
  switchEvent,
  GATEWAY_CHANNEL,
  CLIENT_READY,
  TypeGateway,
} from "./../../finder/events/eventGateway";
import { loadHtml } from "./common";
import { app, BrowserWindow, Menu } from "electron";
import { initFinder } from "../../finder";
initFinder();

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    // width: 500,
    // height: 500,
    minWidth: 500,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
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
