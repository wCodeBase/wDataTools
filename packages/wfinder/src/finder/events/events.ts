import { merge } from "rxjs";
import { debounceTime, throttleTime } from "rxjs/operators";
import { useBehaviorSubjectValue } from "wjstools";
import { TypeDbInfo } from "../types";
import {
  JsonBehaviorSubject,
  JsonSubject,
  ShallowJsonBehaviorSubject,
} from "wjstools";
import {
  FinderStatus,
  MsgHeartbeat,
  TypeDatabaseInfos,
  TypeFinderStatus,
  TypeLinkedRemote,
  TypeLogMessage,
  TypeOsInfo,
  TypeServerState,
  TypeUiMsgData,
  TypeUiMsgResult,
  TypeUiStatus,
} from "./types";

export const EvFinderStatus = new ShallowJsonBehaviorSubject<TypeFinderStatus>({
  status: FinderStatus.idle,
  scanAbsPathContexIdtMap: new Map(),
  searchContextIdSet: new Set(),
});

export const EvDefaultDbInfo = new JsonBehaviorSubject<TypeDbInfo | undefined>(
  undefined
);

export const useFinderStatus = () => useBehaviorSubjectValue(EvFinderStatus);

/** Triggered when FileInfo inserted or deleted */
export const EvFileInfoChange = (() => {
  const subject = new JsonBehaviorSubject<TypeDbInfo | null>(null);
  const observer = merge(
    subject.pipe(debounceTime(500)),
    subject.pipe(throttleTime(500))
  );
  return Object.assign(new JsonBehaviorSubject<TypeDbInfo | null>(null), {
    next: subject.next.bind(subject),
    subscribe: observer.subscribe.bind(observer),
    pipe: subject.pipe.bind(subject),
  });
})();

export const EvDatabaseInfos = new JsonBehaviorSubject<TypeDatabaseInfos>({
  totalFileInfoCount: 0,
  localFileInfoCount: 0,
  remoteFileInfoCount: 0,
});

export const EvConsole = new JsonBehaviorSubject<TypeLogMessage | undefined>(
  undefined
);

export const EvLog = (...args: any[]) =>
  EvConsole.next({ type: "log", message: args.join(", "), at: new Date() });
export const EvLogError = (...args: any[]) =>
  EvConsole.next({ type: "error", message: args.join(", "), at: new Date() });
export const EvLogWarn = (...args: any[]) =>
  EvConsole.next({ type: "warn", message: args.join(", "), at: new Date() });

export const EvUiCmd = new JsonBehaviorSubject<TypeUiMsgData | null>(null);

export const EvUiCmdResult = new JsonSubject<TypeUiMsgResult | MsgHeartbeat>();

export const EvUiCmdMessage = new JsonSubject<TypeLogMessage>();

export const sendUiCmdMessage = (msg: Omit<TypeLogMessage, "at">) =>
  EvUiCmdMessage.next({ ...msg, at: new Date() });

export const EvUiLaunched = new ShallowJsonBehaviorSubject<TypeUiStatus>({});

export const EvFinderReady = new JsonBehaviorSubject<boolean>(false);

export const EvFinderState = new ShallowJsonBehaviorSubject({
  config: undefined as TypeDbInfo | undefined,
  remotes: {} as TypeLinkedRemote,
  servers: {} as TypeServerState,
  osInfo: {} as TypeOsInfo,
});
