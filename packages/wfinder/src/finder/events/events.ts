import { BehaviorSubject, Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { useBehaviorSubjectValue } from "../../ui/hooks/hooks";
import {
  FinderState,
  TypeDatabaseInfos,
  TypeUiMsgData,
  TypeUiMsgMessage,
  TypeUiMsgResult,
  TypeUiStatus,
} from "./types";

export const EvFinderState = new BehaviorSubject(FinderState.idle);

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

export const EvConsole = new BehaviorSubject("");

export const EvLog = (...args: any[]) => EvConsole.next(args.join(", "));

export const EvUiCmd = new Subject<TypeUiMsgData>();

export const EvUiCmdResult = new Subject<TypeUiMsgResult>();

export const EvUiCmdMessage = new Subject<TypeUiMsgMessage>();

export const EvUiStatus = (() => {
  const subject = new BehaviorSubject<TypeUiStatus>({});
  const next = subject.next.bind(subject);
  subject.next = (val) => next({ ...subject.value, ...val });
  return subject;
})();
