import { BrowserWindow } from "electron";
import path from "path";

export const isDev = process.env.NODE_ENV === "development";

export const htmlFileRoot = isDev
  ? `http://localhost:${
      require("../../../webpack-configs/setting.js").devServerPort
    }/`
  : path.resolve(__dirname, "../html/index.html");

export const loadHtml = (window: BrowserWindow, path = htmlFileRoot) => {
  if (isDev) window.loadURL(path);
  else window.loadFile(path);
};
