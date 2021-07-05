import { BehaviorSubject as _BehaviorSubject, Subject as _Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { TypeJsonData } from "../../tools/json";
import { useBehaviorSubjectValue } from "../../ui/hooks/hooks";
import {
  FinderState,
  TypeDatabaseInfos,
  TypeUiMsgData,
  TypeUiMsgMessage,
  TypeUiMsgResult,
  TypeUiStatus,
} from "./types";

class BehaviorSubject<T extends TypeJsonData> extends _BehaviorSubject<T> {}
class Subject<T extends TypeJsonData> extends _Subject<T> {}

export const EvFinderState = new BehaviorSubject<FinderState>(FinderState.idle);

export const useFinderState = () => useBehaviorSubjectValue(EvFinderState);

/** Triggered when FileInfo inserted or deleted */
export const EvFileInfoChange = (() => {
  const subject = new BehaviorSubject<void>(undefined);
  const observer = subject.pipe(debounceTime(500));
  return {
    next: subject.next.bind(subject),
    subscribe: observer.subscribe.bind(observer),
  };
})();

export const EvDatabaseInfos = new BehaviorSubject<TypeDatabaseInfos>({
  fileInfoCount: 0,
});

export const EvConsole = new BehaviorSubject<string>("");

export const EvLog = (...args: any[]) => EvConsole.next(args.join(", "));

export const EvUiCmd = new Subject<TypeUiMsgData>();

export const EvUiCmdResult = new Subject<TypeUiMsgResult>();

export const EvUiCmdMessage = new Subject<TypeUiMsgMessage>();

export const EvUiLaunched = (() => {
  const subject = new BehaviorSubject<TypeUiStatus>({});
  const next = subject.next.bind(subject);
  subject.next = (val) => next({ ...subject.value, ...val });
  return subject;
})();
