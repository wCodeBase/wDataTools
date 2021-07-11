import { WebEventStatus, wEvEventStatus } from "./../../finder/events/webEvent";
import { switchEvent } from "../../finder/events/eventGateway";
import { EVENT_WEBSOCKET_ROUTE } from "../../constants";
import { GATEWAY_CHANNEL, CLIENT_READY } from "./eventTools";

const electron = eval(`try{require('electron')}catch(e){}`);

export const isElectron = !!electron?.ipcRenderer;

export const webInitEvent = async () => {
  if (isElectron) {
    try {
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
      wEvEventStatus.next(WebEventStatus.connected);
    } catch (e) {
      console.error("Init electron event failed", e);
    }
  } else {
    try {
      const wss = `ws${location.protocol === "https:" ? "s" : ""}://${
        location.host
      }${EVENT_WEBSOCKET_ROUTE}`;
      const tryReconnect = () => setTimeout(() => connect(true), 3000);
      const connect = async (isReconnect = false) => {
        wEvEventStatus.next(WebEventStatus.connecting);
        const socket = new WebSocket(wss);
        await new Promise<void>((res, rej) => {
          socket.onerror = isReconnect
            ? () => {
                wEvEventStatus.next(WebEventStatus.failed);
                tryReconnect();
              }
            : rej;
          socket.onopen = () => {
            const gateway = switchEvent((data) => socket.send(data), false);
            socket.onmessage = (ev) => gateway.receive(ev.data);
            socket.onclose = () => {
              gateway.unsubscribe();
              wEvEventStatus.next(WebEventStatus.broken);
              tryReconnect();
            };
            wEvEventStatus.next(WebEventStatus.connected);
            res();
          };
        });
      };
      await connect();
    } catch (e) {
      wEvEventStatus.next(WebEventStatus.failed);
      console.error("Init websocket event failed", e);
    }
  }
};
