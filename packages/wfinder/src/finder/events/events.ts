import { BehaviorSubject, Subject} from "rxjs";
import { useBehaviorSubjectValue } from "../../ui/hooks/hooks";
import {FinderState, TypeUiMsgData, TypeUiMsgMessage, TypeUiMsgResult} from "./types";

export const EvFinderState = new BehaviorSubject(FinderState.idle);

export const useFinderState = ()=>useBehaviorSubjectValue(EvFinderState);

/** Triggered when FileInfo inserted or deleted */
export const EvFileInfoChange = new BehaviorSubject<void>(undefined);

export const EvConsole = new BehaviorSubject('');

export const EvLog = (...args: any[]) => EvConsole.next(args.join(', '));

export const EvUiCmd = new Subject<TypeUiMsgData>();

export const EvUiCmdResult = new Subject<TypeUiMsgResult>();

export const EvUiCmMessage = new Subject<TypeUiMsgMessage>();
