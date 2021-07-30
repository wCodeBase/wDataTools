import { Config, isDev } from "./common";
import { getConnection } from "./db";
import { renderInkUi } from "../ui/ink";
import { linkRemotes } from "./events/core/coreState";
import { cEvFinderState } from "./events/core/coreEvents";
import { EvDefaultDbInfo, EvFinderReady } from "./events/events";
import { FileInfo } from "./entities/FileInfo";
import { FileType } from "./types";

export const initFinder = async () => {
  await getConnection();
  require("./events/uiCmdExecutor");
  require("./events/eventFiller");
  await linkRemotes();
  cEvFinderState.next({ configStack: [{ ...Config }], configIndex: 0 });
  EvDefaultDbInfo.next(Config);
  EvFinderReady.next(true);
};

export const finder = async () => {
  await initFinder();
  renderInkUi();
};
