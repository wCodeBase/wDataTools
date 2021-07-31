import { Subscription } from "rxjs";
import { JsonMore } from "../../tools/json";
import {
  TypeDefaultSpecialJsonType,
  TypeJsonData,
  _TypeJsonData,
  _TypeJsonMore,
} from "./../../tools/json";
import { ComsumableEvent, JsonBehaviorSubject, JsonSubject } from "./eventLib";
import { EvLogWarn, EvUiCmd, EvUiCmdResult } from "./events";
import {
  GatewayMessage,
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
export type TypeGateway = {
  receive: (data: string) => void;
  destory: () => void;
};

export const switchEventInSubjects = <T>(
  subjects: Record<string, any>,
  jsonMore: _TypeJsonMore<T | TypeDefaultSpecialJsonType>
) => {
  return (
    send: (data: string) => void,
    isMaster: boolean,
    packer?: (
      data: _TypeJsonData<T | TypeDefaultSpecialJsonType>
    ) => _TypeJsonData<T | TypeDefaultSpecialJsonType>,
    unPacker?: (
      data: _TypeJsonData<T | TypeDefaultSpecialJsonType>
    ) => _TypeJsonData<T | TypeDefaultSpecialJsonType>
  ): TypeGateway => {
    let destoried = false;
    const subscribes: Subscription[] = [];
    const subjectLastValueMap: Record<string, any> = {};
    Object.entries(subjects).forEach(([subjectName, subject]) => {
      if (
        !(
          subject instanceof JsonSubject ||
          subject instanceof JsonBehaviorSubject
        )
      )
        return;
      const sendMsg = (data: TypeJsonData) => {
        if (data === subjectLastValueMap[subjectName]) return;
        const msg: GatewayMessage = {
          label: "GatewayMessage",
          subjectName,
          data,
          fromMaster: isMaster,
        };
        try {
          send(jsonMore.stringify(packer ? packer(msg) : msg));
        } catch (e) {
          subjects.EvLogError(
            "Error in eventGateway, failed to stringify message data: ",
            data,
            "\nerror: ",
            e
          );
        }
      };
      if (!isMaster && subject instanceof JsonBehaviorSubject)
        subjectLastValueMap[subjectName] = subject.value;
      subscribes.push(subject.subscribe(sendMsg));
    });
    return {
      receive: (data: string) => {
        if (destoried) return;
        try {
          // @ts-ignore
          const msg: GatewayMessage | null = unPacker
            ? unPacker(jsonMore.parse(data))
            : jsonMore.parse(data);
          if (msg && msg.label === "GatewayMessage") {
            subjectLastValueMap[msg.subjectName] = msg.data;
            // @ts-ignore
            subjects[msg.subjectName]?.next?.(msg.data);
          }
        } catch (e) {
          subjects.EvLogError(
            "Error in eventGateway, failed to parse message data: ",
            data,
            "\nerror: ",
            e
          );
        }
      },
      destory: () => {
        subscribes.forEach((sub) => sub.unsubscribe());
        destoried = true;
      },
    };
  };
};

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
