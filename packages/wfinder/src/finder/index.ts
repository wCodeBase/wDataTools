import { getConnection } from "./db";
import { renderInkUi } from "../ui/ink";

export const finder = async () => {
  require("./events/uiCmdExecutor");
  require("./events/eventFiller");
  await getConnection();
  renderInkUi();
};
