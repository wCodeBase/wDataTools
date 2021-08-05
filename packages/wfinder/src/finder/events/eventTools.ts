import {
  ComsumableEvent,
  JsonMore,
  _TypeJsonData,
  _TypeJsonMore,
} from "wjstools";
import { EvLogWarn, EvUiCmd, EvUiCmdResult } from "./events";
import {
  isCommonMsgResult,
  isRemoteHeartBeat,
  judgeUiMsgResultType,
  RemoteError,
  RemoteHeartbeat,
  RemoteMessage,
  ToCommonMsgData,
  ToCommonMsgItem,
  ToCommonMsgResult,
  TypeCommonMsgContentDef,
  TypeCommonMsgDef,
  TypeUiMsgDataMap,
  TypeUiMsgResultMap,
} from "./types";

export class ErrorExecuteTimeout extends Error {}

export type ExecuteUiCmdInterceptor = <T extends keyof TypeUiMsgDataMap>(
  cmd: T,
  cmdData: TypeUiMsgDataMap[T]
) => Promise<TypeUiMsgResultMap[T] | undefined>;

export const executeUiCmdInterceptors = new Set<ExecuteUiCmdInterceptor>();

export const uiMsgTimeout = 5000;

export const executeUiCmd = async <T extends keyof TypeUiMsgDataMap>(
  cmd: T,
  cmdData: TypeUiMsgDataMap[T],
  timeout = uiMsgTimeout
) => {
  let interceptRes: TypeUiMsgResultMap[T] | undefined;
  const iterator = executeUiCmdInterceptors.entries();
  while (!interceptRes) {
    const { value } = iterator.next();
    const interceptor = value?.[0];
    if (!interceptor) break;
    interceptRes = await interceptor(cmd, cmdData);
  }
  const { tag = Math.random() } = cmdData;
  return await new Promise<TypeUiMsgResultMap[T]>((res, rej) => {
    const doTimeout = () => {
      subscribe.unsubscribe();
      rej(new ErrorExecuteTimeout(`Execute cmd ${cmd} timeout.`));
    };
    let tHandle = timeout === Infinity ? null : setTimeout(doTimeout, timeout);
    const subscribe = EvUiCmdResult.subscribe((data) => {
      if (data.cmd === "MsgHeartbeat") {
        if (tHandle) {
          clearTimeout(tHandle);
          tHandle = setTimeout(doTimeout, timeout);
        }
      } else if (judgeUiMsgResultType<T>(data, cmd) && data.tag === tag) {
        subscribe.unsubscribe();
        if (tHandle) clearTimeout(tHandle);
        res(data);
      }
    });
    EvUiCmd.next({ ...cmdData, tag });
  });
};

export const GATEWAY_CHANNEL = "GatewayChannel";
export const CLIENT_READY = "ClientReady";

// TODO: idle heartBeat
export const genRemoteCaller = <K, T extends TypeCommonMsgDef<K>>(
  send: (data: string) => void,
  jsonMore: _TypeJsonMore<K>,
  timeout = 5000
) => {
  type TypeMsg = ToCommonMsgData<K, T>;
  type TypeResult = ToCommonMsgResult<K, T>;

  const tagPromiseMap: Record<
    string,
    { res: (v: any) => void; rej: (v: string) => void; heatBeat: () => void }
  > = {};
  const recieve = (data: string) => {
    try {
      // @ts-ignore
      const msg: RemoteMessage | RemoteHeartbeat | RemoteError | null =
        jsonMore.parse(data);
      if (msg?.label === "RemoteHeartbeat") {
        tagPromiseMap[msg.tag]?.heatBeat();
      } else if (msg?.label === "RemoteError") {
        tagPromiseMap[msg.tag]?.rej(msg.error);
      } else if (msg?.label === "RemoteMessage") {
        if (msg.type === "res") tagPromiseMap[msg.tag]?.res(msg.data);
      }
    } catch (e) {
      EvLogWarn("Warning: recieve invalid data from remote call", data);
    }
  };
  return {
    recieve,
    call: <T extends keyof TypeMsg>(msg: TypeMsg[T], callTimeout = timeout) => {
      return new Promise<TypeResult[T]>((res, _rej) => {
        let tag: string;
        do {
          tag = Date.now().toString(36) + Math.random().toString(36);
        } while (tag in tagPromiseMap);
        const data: RemoteMessage<K> = {
          label: "RemoteMessage",
          tag,
          type: "cmd",
          data: msg,
        };
        const rej: typeof _rej = (e) => {
          clearTimeout(tHandle);
          delete tagPromiseMap[tag];
          _rej(e);
        };
        let tHandle = setTimeout(
          () => rej(new ErrorExecuteTimeout()),
          callTimeout
        );
        tagPromiseMap[tag] = {
          rej,
          res: (data) => {
            clearTimeout(tHandle);
            delete tagPromiseMap[tag];
            res(data);
          },
          heatBeat: () => {
            clearTimeout(tHandle);
            tHandle = setTimeout(() => rej(new ErrorExecuteTimeout()), timeout);
          },
        };
        send(jsonMore.stringify(data));
      });
    },
  };
};

export const genRemoteExector = <K, T extends TypeCommonMsgDef<K>>(
  send: (data: string) => void,
  jsonMore: _TypeJsonMore<K>,
  timeout = 5000
) => {
  type TypeMsg = ToCommonMsgData<K, T>;
  type TypeResult = ToCommonMsgResult<K, T>;

  return (
    executor: <T extends keyof TypeMsg>(
      msg: TypeMsg[T]
    ) => Promise<TypeResult[T]>
  ) => {
    const recieve = async (data: string) => {
      try {
        // @ts-ignore
        const msg: RemoteMessage | null = jsonMore.parse(data);
        if (msg?.label === "RemoteMessage" && msg.type === "cmd") {
          const interval = setInterval(() => {
            send(
              jsonMore.stringify({
                label: "RemoteHeartbeat",
                tag: msg.tag,
              } as RemoteHeartbeat)
            );
          }, timeout / 4);
          try {
            // @ts-ignore
            const callData: TypeMsg[keyof TypeMsg] = msg.data;
            const res = await executor(callData);
            const { data: _, ...rest } = callData; // eslint-ignore-line @typescript-eslint/no-unused-vars
            const resData: Omit<TypeCommonMsgContentDef<any>, "data"> = {
              ...rest,
              result: res,
            };
            send(
              jsonMore.stringify({
                label: "RemoteMessage",
                type: "res",
                data: resData,
                tag: msg.tag,
              } as RemoteMessage<K>)
            );
          } catch (e) {
            send(
              jsonMore.stringify({
                label: "RemoteError",
                tag: msg.tag,
                error: String(e),
              } as RemoteError)
            );
          } finally {
            clearInterval(interval);
          }
        }
      } catch (e) {
        EvLogWarn("Warning: recieve invalid data from remote call", data);
      }
    };
    return {
      recieve,
    };
  };
};

export const keepHeartBeat = (
  send: (data: string) => void,
  tag: RemoteHeartbeat["tag"],
  interval = uiMsgTimeout / 4
) => {
  let tHandle: number | undefined;
  const heartBeatMsg: RemoteHeartbeat = { label: "RemoteHeartbeat", tag };
  const start = () => {
    if (tHandle !== undefined) clearInterval(tHandle);
    tHandle = Number(
      setInterval(() => {
        send(JsonMore.stringify(heartBeatMsg));
      }, interval)
    );
  };
  start();
  return {
    stop: () => {
      if (tHandle !== undefined) {
        clearInterval(tHandle);
        tHandle = undefined;
      }
    },
    restart: start,
  };
};

export const hearHeartBeat = <K>(
  onTimeout: () => void,
  tag: RemoteHeartbeat["tag"],
  recieve: ComsumableEvent<RemoteHeartbeat | _TypeJsonData<K>>,
  timeout = uiMsgTimeout
) => {
  let tHandle: number | undefined;
  const timeoutTriggered = false;
  const hear = () => {
    if (tHandle) clearTimeout(tHandle);
    tHandle = Number(
      setTimeout(() => {
        if (timeoutTriggered) return;
        onTimeout();
      }, timeout)
    );
  };
  recieve.subscribe({
    next: (msg) => {
      if (isRemoteHeartBeat(msg) && msg.tag === tag) {
        if (!timeoutTriggered) hear();
        return true;
      }
      return false;
    },
    destory: () => {
      if (tHandle) clearTimeout(tHandle);
    },
  });
};

export const executeRemoteMsg = <
  K,
  T extends TypeCommonMsgDef<K>,
  M extends keyof ToCommonMsgData<K, T> = keyof ToCommonMsgData<K, T>
>(
  msg: ToCommonMsgData<K, T>[M],
  send: (data: string) => void,
  recieve: ComsumableEvent<
    ToCommonMsgItem<K, T> | RemoteHeartbeat | _TypeJsonData<K>
  >,
  jsonMore: _TypeJsonMore<K>,
  heartBeat: boolean,
  timeout = uiMsgTimeout
) => {
  return new Promise<ToCommonMsgResult<K, T>[M]>((res, rej) => {
    const tag = msg.tag
      ? String(msg.tag)
      : Math.random().toString(36) + Date.now().toString(36);
    msg.tag = tag;
    if (heartBeat)
      hearHeartBeat<K>(
        () => rej("executeRemoteMsg timeout:" + jsonMore.stringify(msg)),
        tag,
        recieve,
        timeout
      );
    recieve.subscribe({
      next: (data) => {
        if (isCommonMsgResult<K, T, M>(data)) {
          if (data.cmd === msg.cmd && data.tag === msg.tag) {
            res(data);
            return true;
          }
        }
      },
      destory: () => {
        rej(
          "executeRemoteMsg event completed before result: " +
            jsonMore.stringify(msg)
        );
      },
    });
    send(jsonMore.stringify(msg));
  });
};
