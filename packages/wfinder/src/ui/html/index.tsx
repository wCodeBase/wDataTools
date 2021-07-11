import { hot } from "react-hot-loader/root";
import ReactDOM from "react-dom";
import React from "react";
import { FinderUi } from "./pages";
import "./index.css";
import "antd/dist/antd.css";
import { EvConsole } from "../../finder/events/events";
import { webInitEvent } from "../../finder/events/webEventTools";
import { executeUiCmdInterceptors } from "../../finder/events/eventTools";
import { WebEventStatus, wEvEventStatus } from "../../finder/events/webEvent";

webInitEvent();
executeUiCmdInterceptors.add(async () => {
  if (wEvEventStatus.value !== WebEventStatus.connected)
    throw new Error("Server is not connected yet.");
  return undefined;
});

EvConsole.subscribe((val) => {
  console.warn(val);
});

const Root = hot(() => <FinderUi />);

ReactDOM.render(<Root />, document.getElementById("react-root"));

// @ts-ignore
if (module.hot) {
  // @ts-ignore
  module.hot.accept("./pages");
}
