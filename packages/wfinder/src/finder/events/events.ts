import { debounceTime } from "rxjs/operators";
import {
  FinderStatus,
  TypeDatabaseInfos,
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
} from "./eventTools";
import { useBehaviorSubjectValue } from "../../ui/hooks/hooks";

export const EvFinderStatus = new JsonBehaviorSubject<FinderStatus>(
  FinderStatus.idle
);

export const EvDefaultDbInfo = new JsonBehaviorSubject<TypeDbInfo | undefined>(
  undefined
);

export const useFinderStatus = () => useBehaviorSubjectValue(EvFinderStatus);

/** Triggered when FileInfo inserted or deleted */
export const EvFileInfoChange = (() => {
  const subject = new JsonBehaviorSubject(null);
  const observer = subject.pipe(debounceTime(500));
  return Object.assign(new JsonBehaviorSubject(null), {
    next: subject.next.bind(subject),
    subscribe: observer.subscribe.bind(observer),
    pipe: subject.pipe.bind(subject),
  });
})();

export const EvDatabaseInfos = new JsonBehaviorSubject<TypeDatabaseInfos>({
  fileInfoCount: 0,
});

export const EvConsole = new JsonBehaviorSubject<string>("");

export const EvLog = (...args: any[]) => EvConsole.next(args.join(", "));

export const EvUiCmd = new JsonSubject<TypeUiMsgData>();

export const EvUiCmdResult = new JsonSubject<TypeUiMsgResult>();

export const EvUiCmdMessage = new JsonSubject<TypeUiMsgMessage>();

export const EvUiLaunched = new ShallowJsonBehaviorSubject<TypeUiStatus>({});

export const EvConfigLineChange = new JsonSubject<null>();

export const EvScanPathChange = new JsonSubject<null>();
