import { renderInkUi } from "../ui/ink";
import { Config } from "./common";
import { getConnection } from "./db";
import { cEvFinderState } from "./events/core/coreEvents";
import { linkRemotes, watchAutoRescan } from "./events/core/coreState";
import { EvDefaultDbInfo, EvFinderReady } from "./events/events";

export const initFinder = async (isInkUi = false) => {
  await getConnection();
  require("./events/uiCmdExecutor");
  require("./events/eventFiller");
  if (!isInkUi) {
    await linkRemotes();
    watchAutoRescan();
  }
  cEvFinderState.next({ configStack: [{ ...Config }], configIndex: 0 });
  EvDefaultDbInfo.next(Config);
  EvFinderReady.next(true);
};

export const finder = async () => {
  await initFinder(true);
  renderInkUi();
};
