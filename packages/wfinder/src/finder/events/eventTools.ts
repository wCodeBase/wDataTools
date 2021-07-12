import { EvLog, EvUiCmd, EvUiCmdResult } from "./events";
import {
  judgeUiMsgResultType,
  TypeUiMsgDataMap,
  TypeUiMsgResultMap,
  GatewayMessage,
  RemoteHeartbeat,
  RemoteMessage,
  RemoteError,
  TypeCommonMsgDef,
  ToCommonMsgData,
  ToCommonMsgResult,
  TypeCommonMsgResultDef,
} from "./types";
import { TypeJsonData, TypeJsonMore, TypeJsonObject } from "./../../tools/json";
import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";
import { JsonMore } from "../../tools/json";
import { isCompleteType } from "../../tools/tool";

export class ErrorExecuteTimeout extends Error {}

export type ExecuteUiCmdInterceptor = <T extends keyof TypeUiMsgDataMap>(
  cmd: T,
  cmdData: TypeUiMsgDataMap[T]
) => Promise<TypeUiMsgResultMap[T] | undefined>;

export const executeUiCmdInterceptors = new Set<ExecuteUiCmdInterceptor>();

export const executeUiCmd = async <T extends keyof TypeUiMsgDataMap>(
  cmd: T,
  cmdData: TypeUiMsgDataMap[T],
  timeout = 5000
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
    const subscribe = EvUiCmdResult.subscribe((data) => {
      if (judgeUiMsgResultType<T>(data, cmd) && data.tag === tag) {
        subscribe.unsubscribe();
        clearTimeout(tHandle);
        res(data);
      }
    });
    EvUiCmd.next({ ...cmdData, tag });
    const tHandle = setTimeout(() => {
      subscribe.unsubscribe();
      rej(new ErrorExecuteTimeout(`Execute cmd ${cmd} timeout.`));
    }, timeout);
  });
};

export const GATEWAY_CHANNEL = "GatewayChannel";
export const CLIENT_READY = "ClientReady";
export type TypeGateway = {
  receive: (data: string) => void;
  unsubscribe: () => void;
};

export class JsonBehaviorSubject<
  T extends TypeJsonData
> extends BehaviorSubject<T> {}

const shallowMergeSubjectValue = <T>(newData: Partial<T>, oldData: T) => {
  return isCompleteType(newData, oldData)
    ? newData
    : { ...oldData, ...newData };
};
export class ShallowBehaviorSubject<
  T extends Record<string, any>
> extends BehaviorSubject<T> {
  constructor(value: T) {
    super(value);
  }
  next(v: Partial<T>) {
    this.value;
    super.next(shallowMergeSubjectValue(v, this.value));
  }
}
export class ShallowJsonBehaviorSubject<
  T extends TypeJsonObject
> extends JsonBehaviorSubject<T> {
  constructor(value: T) {
    super(value);
  }
  next(v: Partial<T>) {
    this.value;
    super.next(shallowMergeSubjectValue(v, this.value));
  }
}

export class JsonSubject<T extends TypeJsonData> extends Subject<T> {}

export const switchEventInSubjects = (
  subjects: Record<string, any>,
  jsonMore = JsonMore
) => {
  return (send: (data: string) => void, isMaster: boolean): TypeGateway => {
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
          send(jsonMore.stringify(msg));
        } catch (e) {
          subjects.EvLog(
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
        try {
          // @ts-ignore
          const msg: GatewayMessage | null = jsonMore.parse(data);
          if (msg && msg.label === "GatewayMessage") {
            subjectLastValueMap[msg.subjectName] = msg.data;
            // @ts-ignore
            subjects[msg.subjectName]?.next?.(msg.data);
          }
        } catch (e) {
          subjects.EvLog(
            "Error in eventGateway, failed to parse message data: ",
            data,
            "\nerror: ",
            e
          );
        }
      },
      unsubscribe: () => {
        subscribes.forEach((sub) => sub.unsubscribe());
      },
    };
  };
};

// TODO: idle heartBeat
export const genRemoteCaller = <K, T extends TypeCommonMsgDef<K>>(
  send: (data: string) => void,
  jsonMore: TypeJsonMore = JsonMore,
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
      EvLog("Warning: recieve invalid data from remote call", data);
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
        const data: RemoteMessage = {
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
  jsonMore = JsonMore,
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
            const { data: _, ...rest } = callData;
            const resData: Omit<TypeCommonMsgResultDef<any>, "data"> = {
              ...rest,
              result: res,
            };
            send(
              jsonMore.stringify({
                label: "RemoteMessage",
                type: "res",
                data: resData,
                tag: msg.tag,
              } as RemoteMessage)
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
        EvLog("Warning: recieve invalid data from remote call", data);
      }
    };
    return {
      recieve,
    };
  };
};
