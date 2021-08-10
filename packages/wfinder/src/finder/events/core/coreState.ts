import { isEmpty, isEqual } from "lodash";
import { Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { concatUrls, joinToAbsolute, JsonMore } from "wjstools";
import Websocket from "ws";
import { EVENT_ORM_METHOD_WEBSOCKET_ROUTE } from "../../../constants";
import { Config } from "../../common";
import { switchDb } from "../../db";
import { ConfigLine } from "../../entities/ConfigLine";
import { DbIncluded } from "../../entities/DbIncluded";
import { doScan } from "../../scan";
import {
  ConfigLineType,
  defaultAutoScanSetting,
  getDbInfoId,
  isScanDurationAvailable,
  TypeDbInfo,
} from "../../types";
import { EvLog, EvLogWarn, EvUiCmdResult } from "../events";
import { genRemoteCaller, uiMsgTimeout } from "../eventTools";
import {
  cEvConfigLineChange,
  cEvDbIncludedChange,
  cEvFinderState,
  cEvRefreshRemote,
  cTypeLinkedRemote,
} from "./coreEvents";
import { JsonMoreEntity } from "./coreTypes";

export function waitWsConnected(
  url: string,
  throwError: true,
  silent?: boolean,
  timeout?: number
): Promise<Websocket>;
export function waitWsConnected(
  url: string,
  throwError: false,
  silent?: boolean,
  timeout?: number
): Promise<Websocket | false>;
export function waitWsConnected(
  url: string,
  throwError: boolean,
  silent?: boolean,
  timeout = uiMsgTimeout
): Promise<Websocket | false> {
  return new Promise<Websocket | false>((res, rej) => {
    let _socket: Websocket | undefined;
    const tHandle = setTimeout(() => {
      onFailed({ error: "waitWsConnected timeout" });
    }, timeout);
    const onFailed = (ev: any) => {
      clearTimeout(tHandle);
      const error =
        ev.error || `waitWsConnected websocket closed: ${ev.reason}`;
      if (throwError) rej(error);
      if (!silent) console.warn(error);
      res(false);
      if (
        _socket &&
        _socket.readyState !== _socket.CLOSED &&
        _socket.readyState !== _socket.CLOSING
      )
        _socket.close();
    };
    try {
      _socket = new Websocket(url);
    } catch (e) {
      onFailed({ error: `Create  websocket failed: ${e}` });
    }
    if (!_socket) {
      res(false);
      return;
    }
    const socket = _socket;
    socket.addEventListener("error", onFailed);
    socket.addEventListener("close", onFailed);
    socket.once("open", () => {
      socket?.removeEventListener("error", onFailed);
      socket?.removeEventListener("close", onFailed);
      clearTimeout(tHandle);
      res(socket);
    });
  });
}

export const { linkRemotes, unlinkRemotes } = (() => {
  let interval: NodeJS.Timeout | undefined;
  let subscribes: Subscription[] | undefined;
  const doClear = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
    if (subscribes) {
      subscribes.forEach((s) => s.unsubscribe());
      subscribes = undefined;
    }
  };
  const linkRemotes = (retryInterval = 60000) => {
    doClear();
    const sync = async (retry = false) => {
      const { linkedRemote } = cEvFinderState.value;
      const newLinkedRemote: typeof linkedRemote = { ...linkRemotes };
      const remotes = await ConfigLine.find({
        where: { type: ConfigLineType.remoteUrl },
      });
      const toLinkRemotes = remotes.filter(
        (v) =>
          !v.disabled &&
          (!linkedRemote[v.content] ||
            (retry && linkedRemote[v.content].unavailable) ||
            linkedRemote[v.content].broken)
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
        const doLink = async (
          v: ConfigLine,
          linkedRemote = newLinkedRemote
        ) => {
          const socket = await waitWsConnected(
            concatUrls(v.content, EVENT_ORM_METHOD_WEBSOCKET_ROUTE),
            false,
            retry
          );
          if (!socket) {
            linkedRemote[v.content] = { unavailable: true };
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
                  doLink(v, cEvFinderState.value.linkedRemote).then(() => {
                    cEvFinderState.next({
                      linkedRemote: { ...cEvFinderState.value.linkedRemote },
                    });
                    EvLog("Reconnect to remote : " + v.content);
                  });
                }, 10000);
                cEvFinderState.next({
                  linkedRemote: { ...cEvFinderState.value.linkedRemote },
                });
                EvLogWarn("Remote connection broken: " + v.content);
              }
            });
            const res: cTypeLinkedRemote = { socket, caller };
            linkedRemote[v.content] = res;
          }
        };
        await Promise.all(toLinkRemotes.map((v) => doLink(v)));
        if (!isEqual(linkRemotes, newLinkedRemote))
          cEvFinderState.next({
            linkedRemote: {
              ...cEvFinderState.value.linkedRemote,
              ...newLinkedRemote,
            },
          });
      }
    };
    subscribes = [
      cEvConfigLineChange.pipe(debounceTime(500)).subscribe(() => sync()),
      cEvRefreshRemote.subscribe(() => sync(true)),
    ];
    interval = setInterval(() => sync(true), retryInterval);
    sync();
  };

  const unlinkRemotes = () => {
    doClear();
    const { linkedRemote } = cEvFinderState.value;
    cEvFinderState.next({ linkedRemote: {} });
    Object.values(linkedRemote).forEach((v) => v.socket?.close());
  };
  return { linkRemotes, unlinkRemotes };
})();

export const watchAutoRescan = (() => {
  const genDbScanWatcher = (config: TypeDbInfo) => {
    let lastScanAt = Date.now();
    let scanDuration = Infinity;
    let tHandle: NodeJS.Timeout | undefined;
    const doWatch = async () => {
      if (!isScanDurationAvailable(scanDuration)) return;
      if (Date.now() - lastScanAt > scanDuration) {
        lastScanAt = Date.now();
        EvLog("Auto scan context: " + config.finderRoot);
        await switchDb(config, doScan).catch((e) => {
          EvLogWarn("Auto scan failed, context: " + config.finderRoot, e);
        });
        lastScanAt = Date.now();
      }
      if (tHandle) clearTimeout(tHandle);
      if (isScanDurationAvailable(scanDuration)) {
        tHandle = setTimeout(doWatch, scanDuration);
      }
    };

    const subscribe = EvUiCmdResult.subscribe((res) => {
      if (
        res.cmd === "listConfig" &&
        !res.result.error &&
        (res.result.oriData.type === ConfigLineType.autoRescan ||
          isEmpty(res.result.oriData)) &&
        getDbInfoId(res.context) === getDbInfoId(config)
      ) {
        const configLine = res.result.results.find(
          (v) => v.type === ConfigLineType.autoRescan
        );
        try {
          let setting = defaultAutoScanSetting;
          if (configLine?.jsonStr) {
            setting = Object.assign(
              { ...defaultAutoScanSetting },
              JsonMore.parse(configLine.jsonStr)
            );
          }
          scanDuration = isScanDurationAvailable(setting.duration)
            ? setting.duration * 3600 * 1000
            : Infinity;
          doWatch();
        } catch (e) {
          EvLogWarn(
            "Failed to parse autoRescan config: " + configLine?.jsonStr
          );
        }
      }
    });
    dbPathWatcherCloseMap.get(config.finderRoot)?.();
    dbPathWatcherCloseMap.set(config.finderRoot, () => {
      subscribe.unsubscribe();
      if (tHandle) clearTimeout(tHandle);
      scanDuration = Infinity;
      dbPathWatcherCloseMap.delete(config.finderRoot);
    });
  };
  const dbPathWatcherCloseMap = new Map<string, () => void>();
  const refreshWatcher = () => {
    switchDb(Config, async () => {
      const dbIncludeds = await DbIncluded.queryAllDbIncluded((handle) =>
        handle.find()
      );
      const newDbIncludesSet = new Set(
        dbIncludeds.map((v) => joinToAbsolute(v.dbInfo.finderRoot, v.path))
      );
      newDbIncludesSet.add(Config.finderRoot);
      Array.from(dbPathWatcherCloseMap.entries()).forEach(([path, close]) => {
        if (!newDbIncludesSet.has(path)) close();
      });
      dbIncludeds
        .map((v) => {
          const finderRoot = joinToAbsolute(v.dbInfo.finderRoot, v.path);
          return {
            ...v.dbInfo,
            finderRoot,
            dbPath: joinToAbsolute(finderRoot, v.dbInfo.dbName),
            isSubDb: true,
          } as TypeDbInfo;
        })
        .concat(Config)
        .forEach((v) => {
          if (!dbPathWatcherCloseMap.has(v.finderRoot)) genDbScanWatcher(v);
        });
    });
  };
  return () => {
    cEvDbIncludedChange.pipe(debounceTime(500)).subscribe(refreshWatcher);
    refreshWatcher();
  };
})();

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
