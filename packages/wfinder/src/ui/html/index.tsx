import ReactDOM from "react-dom";
import React from "react";
import { GATEWAY_CHANNEL, switchEvent } from "../../finder/events/eventGateway";

if (typeof require === "function") {
  try {
    const electron = eval(`require('electron')`);
    if (electron) {
      const gateway = switchEvent((data) =>
        electron.ipcRenderer.send(GATEWAY_CHANNEL, data)
      );
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

ReactDOM.render(<div>test2</div>, document.getElementById("react-root"));
