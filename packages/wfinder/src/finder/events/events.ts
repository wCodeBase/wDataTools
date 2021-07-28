import { debounceTime, throttleTime } from "rxjs/operators";
import {
  FinderStatus,
  MsgHeartbeat,
  TypeDatabaseInfos,
  TypeFinderStatus,
  TypeLinkedRemote,
  TypeOsInfo,
  TypeServerState,
  TypeUiMsgData,
  TypeUiMsgMessage,
  TypeUiMsgResult,
  TypeUiStatus,
} from "./types";
import { TypeDbInfo } from "../types";
import {
  JsonBehaviorSubject,
  JsonSubject,
  ShallowJsonBehaviorSubject,
} from "./eventLib";
import { useBehaviorSubjectValue } from "../../ui/hooks/hooks";
import { concat, merge } from "rxjs";

export const EvFinderStatus = new ShallowJsonBehaviorSubject<TypeFinderStatus>({
  status: FinderStatus.idle,
  scanContextIdAndPathSet: new Set(),
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
  fileInfoCount: 0,
});

export const EvConsole = new JsonBehaviorSubject<
  { message: string; type: "log" | "warn" | "error" } | undefined
>(undefined);

export const EvLog = (...args: any[]) =>
  EvConsole.next({ type: "log", message: args.join(", ") });
export const EvLogError = (...args: any[]) =>
  EvConsole.next({ type: "error", message: args.join(", ") });
export const EvLogWarn = (...args: any[]) =>
  EvConsole.next({ type: "warn", message: args.join(", ") });

export const EvUiCmd = new JsonBehaviorSubject<TypeUiMsgData | null>(null);

export const EvUiCmdResult = new JsonSubject<TypeUiMsgResult | MsgHeartbeat>();

export const EvUiCmdMessage = new JsonSubject<TypeUiMsgMessage>();

export const EvUiLaunched = new ShallowJsonBehaviorSubject<TypeUiStatus>({});

export const EvFinderReady = new JsonBehaviorSubject<boolean>(false);

export const EvFinderState = new ShallowJsonBehaviorSubject({
  config: undefined as TypeDbInfo | undefined,
  remotes: {} as TypeLinkedRemote,
  servers: {} as TypeServerState,
  osInfo: {} as TypeOsInfo,
});
