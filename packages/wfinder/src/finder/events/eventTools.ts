import { EvUiCmd, EvUiCmdResult } from "./events";
import {
  judgeUiMsgResultType,
  TypeUiMsgDataMap,
  TypeUiMsgResultMap,
  GatewayMessage,
} from "./types";
import { TypeJsonData } from "./../../tools/json";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import { JsonMore } from "../../tools/json";

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
export class JsonSubject<T extends TypeJsonData> extends Subject<T> {}

export const switchEventInSubjects =
  (subjects: Record<string, any>) =>
  (send: (data: string) => void, isMaster: boolean): TypeGateway => {
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
          send(JsonMore.stringify(msg));
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
          const msg: GatewayMessage | null = JsonMore.parse(data);
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
