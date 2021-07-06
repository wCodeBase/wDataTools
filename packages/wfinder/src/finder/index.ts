import { getConnection } from "./db";
import { renderInkUi } from "../ui/ink";

export const initFinder = async () => {
  require("./events/uiCmdExecutor");
  require("./events/eventFiller");
  await getConnection();
};

export const finder = async () => {
  await initFinder();
  renderInkUi();
};
