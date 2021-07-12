import { genRemoteCaller } from "../eventTools";
import { EVENT_ORM_METHOD_WEBSOCKET_ROUTE } from "../../../constants";
import { cEvFinderState, cTypeLinkedRemote } from "./coreEvents";
import { EvConfigLineChange } from "../events";
import { ConfigLine } from "../../entities/ConfigLine";
import { debounceTime } from "rxjs/operators";
import { ConfigLineType } from "../../types";
import Websocket from "ws";
import { JsonMoreEntity } from "./coreTypes";

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
        const status = await new Promise((res) => {
          const onFailed = () => res(false);
          socket.addEventListener("error", onFailed);
          socket.addEventListener("close", onFailed);
          socket.once("open", () => {
            socket.removeEventListener("error", onFailed);
            socket.removeEventListener("close", onFailed);
            res(true);
          });
        });
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
              res.reconnectTimeout = setTimeout(() => {
                doLink(v).then(() => {
                  cEvFinderState.next({ ...cEvFinderState.value });
                });
              }, 10000);
              cEvFinderState.next({ ...cEvFinderState.value });
            }
          });
          const res: cTypeLinkedRemote = { socket, caller };
          cEvFinderState.value.linkedRemote[v.content] = res;
        }
      };
      await Promise.all(toLinkRemotes.map((v) => doLink(v)));
      cEvFinderState.next({ ...cEvFinderState.value });
    }
  };
  EvConfigLineChange.pipe(debounceTime(500)).subscribe(sync);
  sync();
};
