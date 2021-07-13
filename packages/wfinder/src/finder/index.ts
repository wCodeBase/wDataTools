import { EvFinderReady } from "./events/events";
import { getConnection } from "./db";
import { renderInkUi } from "../ui/ink";
import { linkRemotes } from "./events/core/coreState";

export const initFinder = async () => {
  await getConnection();
  require("./events/uiCmdExecutor");
  require("./events/eventFiller");
  await linkRemotes();
  EvFinderReady.next(true);
};

export const finder = async () => {
  await initFinder();
  renderInkUi();
};
