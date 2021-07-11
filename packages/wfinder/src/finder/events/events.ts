import { debounceTime } from "rxjs/operators";
import {
  FinderState,
  TypeDatabaseInfos,
  TypeUiMsgData,
  TypeUiMsgMessage,
  TypeUiMsgResult,
  TypeUiStatus,
} from "./types";
import { TypeDbInfo } from "../types";
import { JsonBehaviorSubject, JsonSubject } from "./eventTools";
import { useBehaviorSubjectValue } from "../../ui/hooks/hooks";

export const EvFinderState = new JsonBehaviorSubject<FinderState>(
  FinderState.idle
);

export const EvDefaultDbInfo = new JsonBehaviorSubject<TypeDbInfo | undefined>(
  undefined
);

export const useFinderState = () => useBehaviorSubjectValue(EvFinderState);

/** Triggered when FileInfo inserted or deleted */
export const EvFileInfoChange = (() => {
  const subject = new JsonBehaviorSubject<void>(undefined);
  const observer = subject.pipe(debounceTime(500));
  return Object.assign(new JsonBehaviorSubject<void>(undefined), {
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

export const EvUiLaunched = (() => {
  const subject = new JsonBehaviorSubject<TypeUiStatus>({});
  const next = subject.next.bind(subject);
  subject.next = (val) => {
    next(
      Object.entries(subject.value)
        // @ts-ignore
        .every(([key, value]) => value === val[key])
        ? val
        : { ...subject.value, ...val }
    );
  };
  return subject;
})();
