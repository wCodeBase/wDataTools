import { TypeJsonData } from "./../../tools/json";
import { BehaviorSubject, Subscription } from "rxjs";
import { JsonMore } from "../../tools/json";
import * as subjects from "./events";
import { GatewayMessage } from "./types";

export const GATEWAY_CHANNEL = "GatewayChannel";
export const CLIENT_READY = "ClientReady";
export type TypeGateway = {
  receive: (data: string) => void;
  unsubscribe: () => void;
};

export const switchEvent = (
  send: (data: string) => void,
  isMaster: boolean
): TypeGateway => {
  const subscribes: Subscription[] = [];
  const subjectLastValueMap: Record<string, any> = {};
  Object.entries(subjects).forEach(([subjectName, subject]) => {
    // @ts-ignore
    const subscribe = subject.subscribe;
    if (typeof subscribe === "function") {
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
      if (!isMaster && subject instanceof BehaviorSubject)
        subjectLastValueMap[subjectName] = subject.value;
      subscribes.push(subscribe.call(subject, sendMsg));
    }
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
