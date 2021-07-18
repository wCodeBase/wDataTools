import { executeUiCmd, genRemoteCaller, uiMsgTimeout } from "../eventTools";
import {
  EVENT_ORM_METHOD_WEBSOCKET_ROUTE,
  EVENT_TRANSFER_WEBSOCKET_ROUTE,
} from "../../../constants";
import {
  cEvFinderState,
  cTypeLinkedRemote,
  cTypeTransferRemote,
} from "./coreEvents";
import { EvConfigLineChange } from "../events";
import { ConfigLine } from "../../entities/ConfigLine";
import { debounceTime } from "rxjs/operators";
import { ConfigLineType } from "../../types";
import Websocket from "ws";
import { JsonMoreEntity } from "./coreTypes";
import { switchEvent } from "../eventGateway";

export const waitWsConnected = (
  socket: Websocket,
  throwError = false,
  timeout = uiMsgTimeout
) => {
  return new Promise((res, rej) => {
    const onFailed = (ev: any) => {
      clearTimeout(tHandle);
      const error =
        ev.error || `waitWsConnected websocket closed: ${ev.reason}`;
      if (throwError) rej(error);
      console.warn(error);
      res(false);
      if (
        socket.readyState !== socket.CLOSED &&
        socket.readyState !== socket.CLOSING
      )
        socket.close();
    };
    const tHandle = setTimeout(() => {
      onFailed({ error: "waitWsConnected timeout" });
    }, timeout);
    socket.addEventListener("error", onFailed);
    socket.addEventListener("close", onFailed);
    socket.once("open", () => {
      socket.removeEventListener("error", onFailed);
      socket.removeEventListener("close", onFailed);
      clearTimeout(tHandle);
      res(true);
    });
  });
};

export const linkRemotes = () => {
  const sync = async () => {
    const { linkedRemote } = cEvFinderState.value;
    const remotes = await ConfigLine.find({
      where: { type: ConfigLineType.remoteUrl },
    });
    const toLinkRemotes = remotes.filter(
      (v) => !v.disabled && !linkedRemote[v.content]
    );
    const urlRemoteMap = new Map(remotes.map((v) => [v.content, v]));
    const toDestoryLinks = Object.entries(linkedRemote).filter(
      ([url]) => !urlRemoteMap.get(url) || urlRemoteMap.get(url)?.disabled
    );
    if (toLinkRemotes.length || toDestoryLinks.length) {
      toDestoryLinks.forEach(([url, link]) => {
        delete linkedRemote[url];
        if (link.reconnectTimeout) {
          clearTimeout(link.reconnectTimeout);
          link.reconnectTimeout = undefined;
        }
        link.broken = true;
        link.caller = undefined;
        link.socket?.close();
      });
      const doLink = async (v: ConfigLine) => {
        const socket = new Websocket(
          v.content + EVENT_ORM_METHOD_WEBSOCKET_ROUTE
        );
        const status = await waitWsConnected(socket);
        if (!status) {
          socket.close();
          cEvFinderState.value.linkedRemote[v.content] = { unavailable: true };
        } else {
          const caller = genRemoteCaller(
            (data) => socket.send(data),
            JsonMoreEntity
          );
          socket.on("message", (msg) => caller.recieve(String(msg)));
          socket.on("close", () => {
            if (!res.broken) {
              res.broken = true;
              res.caller = undefined;
              if (res.reconnectTimeout) clearTimeout(res.reconnectTimeout);
              if (!cEvFinderState.value.linkedRemote[v.content]) return;
              res.reconnectTimeout = setTimeout(() => {
                doLink(v).then(() => {
                  cEvFinderState.next({
                    linkedRemote: { ...cEvFinderState.value.linkedRemote },
                  });
                });
              }, 10000);
              cEvFinderState.next({
                linkedRemote: { ...cEvFinderState.value.linkedRemote },
              });
            }
          });
          const res: cTypeLinkedRemote = { socket, caller };
          cEvFinderState.value.linkedRemote[v.content] = res;
        }
      };
      await Promise.all(toLinkRemotes.map((v) => doLink(v)));
      cEvFinderState.next({
        linkedRemote: { ...cEvFinderState.value.linkedRemote },
      });
    }
  };
  EvConfigLineChange.pipe(debounceTime(500)).subscribe(sync);
  sync();
};

export const unlinkRemotes = () => {
  const { linkedRemote } = cEvFinderState.value;
  cEvFinderState.next({ linkedRemote: {} });
  Object.values(linkedRemote).forEach((v) => v.socket?.close());
};

/**
 * Share-socket mode transferRemote, abandoned, maybe useful in the future.
 */
// export const transferRemote = async (url: string) => {
//   if (cEvFinderState.value.transferRemote[url]) return cEvFinderState.value.transferRemote[url];
//   let socket = new Websocket(url + EVENT_TRANSFER_WEBSOCKET_ROUTE);
//   await waitWsConnected(socket,true);
//   let tHandle:NodeJS.Timeout|undefined;
//   let destoried = false;
//   const retry = ()=>{
//     if(destoried) return;
//     remote.status='broken';
//     cEvFinderState.next(cEvFinderState.value);
//     tHandle= setTimeout(async ()=>{
//       socket = new Websocket(url + EVENT_TRANSFER_WEBSOCKET_ROUTE);
//       remote.status='linking';
//       cEvFinderState.next(cEvFinderState.value);
//       const done  =await waitWsConnected(socket);
//       if(!done) retry();
//       else{
//         remote.socket = socket;
//         remote.status='linked';
//         cEvFinderState.next(cEvFinderState.value);
//       }
//     },2000);
//   };
//   socket.on('close',retry);
//   const remote:cTypeTransferRemote = {
//     remoteThumbnail:'',
//     socket,
//     RemoteStatus: {},
//     status: 'linked',
//     destory:()=>{
//       destoried=true;
//       if(tHandle) clearTimeout(tHandle);
//       socket.close();
//     }
//   };
//   cEvFinderState.value.transferRemote[url] = remote;
//   cEvFinderState.next(cEvFinderState.value);
//   return remote;
// };
