import { Config, isDev } from "./common";
import { getConnection } from "./db";
import { renderInkUi } from "../ui/ink";
import { linkRemotes } from "./events/core/coreState";
import { cEvFinderState } from "./events/core/coreEvents";
import { EvFinderReady } from "./events/events";

export const initFinder = async () => {
  await getConnection();
  require("./events/uiCmdExecutor");
  require("./events/eventFiller");
  await linkRemotes();
  cEvFinderState.next({ configStack: [{ ...Config }], configIndex: 0 });
  EvFinderReady.next(true);
};

export const finder = async () => {
  await initFinder();
  renderInkUi();
};
