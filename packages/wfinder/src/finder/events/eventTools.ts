import { EvUiCmd, EvUiCmdResult } from "./events";
import {
  judgeUiMsgResultType,
  TypeUiMsgDataMap,
  TypeUiMsgResultMap,
} from "./types";

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
