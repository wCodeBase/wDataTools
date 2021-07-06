import { hot } from "react-hot-loader/root";
import ReactDOM from "react-dom";
import React from "react";
import {
  CLIENT_READY,
  GATEWAY_CHANNEL,
  switchEvent,
} from "../../finder/events/eventGateway";
import { FinderUi } from "./pages";
import "./index.css";
import "antd/dist/antd.css";

if (typeof require === "function") {
  try {
    const electron = eval(`try{require('electron')}catch(e){}`);
    if (electron) {
      electron.ipcRenderer.send(GATEWAY_CHANNEL, CLIENT_READY);
      const gateway = switchEvent((data) => {
        electron.ipcRenderer.send(GATEWAY_CHANNEL, data);
      }, false);
      electron.ipcRenderer.addListener(
        GATEWAY_CHANNEL,
        (_: any, data: string) => {
          gateway.receive(data);
        }
      );
    }
  } catch (e) {
    console.error("Import electron failed", e);
  }
}

const Root = hot(() => <FinderUi />);

ReactDOM.render(<Root />, document.getElementById("react-root"));

// @ts-ignore
if (module.hot) {
  // @ts-ignore
  module.hot.accept("./pages");
}
