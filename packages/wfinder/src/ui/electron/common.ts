import { execRoot } from "./../../env";
import { BrowserWindow } from "electron";
import path from "path";
import { isDev } from "../../finder/common";

export const htmlFileRoot = isDev
  ? `http://localhost:${
      require("../../../webpack-configs/setting.js").devServerPort
    }/`
  : path.resolve(execRoot, "ui/html/index.html");

export const loadHtml = (window: BrowserWindow, path = htmlFileRoot) => {
  if (isDev) window.loadURL(path);
  else window.loadFile(path);
};
