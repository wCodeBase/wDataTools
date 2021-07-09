import { EvUiCmd, EvUiCmdResult } from "./events";
import {
  judgeUiMsgResultType,
  TypeUiMsgDataMap,
  TypeUiMsgResultMap,
} from "./types";

export class ErrorExecuteTimeout extends Error {}

export const executeUiCmd = <T extends keyof TypeUiMsgDataMap>(
  cmd: T,
  cmdData: TypeUiMsgDataMap[T],
  timeout = 5000
) => {
  return new Promise<TypeUiMsgResultMap[T]>((res, rej) => {
    const subscribe = EvUiCmdResult.subscribe((data) => {
      if (judgeUiMsgResultType<T>(data, cmd)) {
        subscribe.unsubscribe();
        clearTimeout(tHandle);
        res(data);
      }
    });
    EvUiCmd.next(cmdData);
    const tHandle = setTimeout(() => {
      subscribe.unsubscribe();
      rej(new ErrorExecuteTimeout(`Execute cmd ${cmd} timeout.`));
    }, timeout);
  });
};
