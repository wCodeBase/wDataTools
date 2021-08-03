import {
  EVENT_TRANSFER_WEBSOCKET_ROUTE,
  EVENT_WEBSOCKET_ROUTE,
} from "../../constants";
import { joinContextPipe, switchEvent } from "../../finder/events/eventGateway";
import { concatUrls } from "../../tools/tool";
import { TypeDbInfo } from "../types";
import { WebEventStatus, wEvEventStatus } from "./../../finder/events/webEvent";
import { ComsumableEvent } from "./eventLib";
import { CLIENT_READY, GATEWAY_CHANNEL } from "./eventTools";

const electron = eval(`try{require('electron')}catch(e){}`);

export const isWebElectron = !!electron?.ipcRenderer;

export const webInitEvent = (() => {
  let gatewaySend = new ComsumableEvent<string>();
  const gateway = switchEvent((data) => gatewaySend.next(data), false);
  function initEvent(
    remoteContext: string[],
    throwError?: boolean
  ): Promise<TypeDbInfo>;
  function initEvent(
    remoteContext?: undefined,
    throwError?: boolean
  ): Promise<void>;
  async function initEvent(
    _remoteContext?: string[],
    throwError = false
  ): Promise<TypeDbInfo | void> {
    const remoteContext = _remoteContext ? [..._remoteContext] : undefined;
    gatewaySend.destory();
    let currentGatewaySend = (gatewaySend = new ComsumableEvent<string>());
    wEvEventStatus.next(WebEventStatus.connecting);
    if (isWebElectron && !remoteContext) {
      try {
        electron.ipcRenderer.send(GATEWAY_CHANNEL, CLIENT_READY);
        const onData = (_: any, data: string) => {
          gateway.receive(data);
        };
        gatewaySend.subscribe({
          next: (data) => electron.ipcRenderer.send(GATEWAY_CHANNEL, data),
          destory: () =>
            electron.ipcRenderer.removeListener(GATEWAY_CHANNEL, onData),
        });
        electron.ipcRenderer.addListener(GATEWAY_CHANNEL, onData);
        wEvEventStatus.next(WebEventStatus.connected);
      } catch (e) {
        console.error("Init electron event failed", e);
        if (throwError)
          throw new Error("Init electron event failed: " + String(e));
      }
    } else {
      try {
        if (remoteContext) {
          if (!isWebElectron) remoteContext.unshift(location.origin);
        }
        const url = remoteContext?.shift() || location.origin;
        const wss = concatUrls(
          url.replace(/^http/, "ws"),
          remoteContext ? EVENT_TRANSFER_WEBSOCKET_ROUTE : EVENT_WEBSOCKET_ROUTE
        );
        const tryReconnect = () => setTimeout(() => connect(true), 3000);
        let currentSocket: WebSocket | undefined;
        const closeCurrentSocket = () => {
          if (!currentSocket) return;
          if (
            ![currentSocket.CLOSED, currentSocket.CLOSING].includes(
              currentSocket.readyState
            )
          ) {
            currentSocket.close();
            currentSocket = undefined;
          }
        };
        gatewaySend.subscribe({ destory: closeCurrentSocket });
        const connect = async (isReconnect = false) => {
          if (currentGatewaySend.isDestoried()) return;
          closeCurrentSocket();
          wEvEventStatus.next(WebEventStatus.connecting);
          const socket = new WebSocket(wss);
          currentSocket = socket;
          return await new Promise<void | TypeDbInfo>((res, rej) => {
            let result: TypeDbInfo | undefined;
            socket.onerror = isReconnect
              ? () => {
                  wEvEventStatus.next(WebEventStatus.failed);
                  tryReconnect();
                }
              : rej;
            socket.onopen = async () => {
              if (!remoteContext) {
                gatewaySend.subscribe({
                  next: (data) => {
                    socket.send(data);
                  },
                });
                socket.onmessage = (ev) => gateway.receive(ev.data);
              } else {
                const startJoint = joinContextPipe({
                  isStartJoint: true,
                  onData: async (data) => {
                    gateway.receive(data);
                    return "";
                  },
                  forward: socket.send.bind(socket),
                });
                socket.onmessage = (ev) => startJoint.recieveFromNext(ev.data);
                gatewaySend.subscribe({
                  next: (data) => {
                    startJoint.sendData(data).catch((e) => {
                      console.warn("startJoint sendData failed:", e);
                    });
                  },
                  destory: startJoint.destory,
                });
                const msg = await startJoint.switchContext(remoteContext);
                if (msg.result.error) {
                  rej(
                    `Failed to switch remote context: ${msg.result.error.msg}, occurred on context: ${msg.result.error.context}`
                  );
                } else
                  result = { ...msg.result.data, remoteUrls: _remoteContext };
              }
              socket.onclose = () => {
                wEvEventStatus.next(WebEventStatus.broken);
                if (!currentGatewaySend.isDestoried()) {
                  currentGatewaySend.destory();
                  currentGatewaySend = gatewaySend =
                    new ComsumableEvent<string>();
                  tryReconnect();
                }
              };
              wEvEventStatus.next(WebEventStatus.connected);
              res(result);
            };
          });
        };
        return await connect();
      } catch (e) {
        gatewaySend.destory();
        wEvEventStatus.next(WebEventStatus.failed);
        console.error("Init websocket event failed", e);
        if (throwError)
          throw new Error("Init websocket event failed: " + String(e));
      }
    }
  }
  return initEvent;
})();
