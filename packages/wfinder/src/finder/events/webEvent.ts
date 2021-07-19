import { EvFinderReady, EvFinderState, EvUiCmd, EvUiCmdResult } from "./events";
import {
  ConfigLineType,
  getDbInfoId,
  getLocalDbInfoStackId,
  TypeDbInfo,
} from "./../types";
import { BehaviorSubject, merge, Subject } from "rxjs";
import { ShallowBehaviorSubject } from "./eventLib";
import { isEmpty, isEqual, last } from "lodash";

export enum WebEventStatus {
  none,
  connecting,
  connected,
  failed,
  broken,
}

export const wEvEventStatus = new BehaviorSubject<WebEventStatus>(
  WebEventStatus.none
);

export type WebContext = {
  localContexts: TypeDbInfo[];
  localOptions?: TypeDbInfo[];
  remoteOptionUrls?: string[];
  remoteUrls?: string[];
};

export const wEvGlobalState = new ShallowBehaviorSubject({
  contextStack: [] as WebContext[],
});

export const getLocalContext = () =>
  last(last(wEvGlobalState.value.contextStack)?.localContexts);

export const wEvFinderReady = new BehaviorSubject<boolean>(false);

export const wEvLocalDbContextChange = new Subject<void>();

EvUiCmdResult.subscribe((msg) => {
  if (msg.cmd === "listConfig" && !msg.result.error) {
    const { type, ...rest } = msg.result.oriData;
    if (type === ConfigLineType.remoteUrl && isEmpty(rest)) {
      if (!wEvFinderReady.value || !EvFinderState.value.config) return;
      const dbId = getDbInfoId(msg.context);
      const context = wEvGlobalState.value.contextStack.find(
        (v) => getDbInfoId(last(v.localContexts)) === dbId
      );
      if (context) {
        const newRemotes = msg.result.results.map((v) => v.content);
        if (!isEqual(newRemotes, context.remoteOptionUrls)) {
          context.remoteOptionUrls = msg.result.results.map((v) => v.content);
          wEvGlobalState.next({
            contextStack: [...wEvGlobalState.value.contextStack],
          });
        }
      }
    }
  } else if (msg.cmd === "listDbIncluded" && !msg.result.error) {
    if (wEvEventStatus.value !== WebEventStatus.connected) return;
    const context = last(wEvGlobalState.value.contextStack);
    if (!context) return;
    const lastLocal = last(context.localContexts);
    if (!lastLocal) return;
    if (getDbInfoId(lastLocal) === getDbInfoId(msg.context)) {
      const parentPath = lastLocal.dbPath.slice(0, -lastLocal.dbName.length);
      context.localOptions = msg.result.data.map((v) => {
        const finderRoot = parentPath + v.path;
        return {
          finderRoot,
          dbName: v.dbName,
          dbPath: finderRoot + "/" + v.dbName,
          isSubDb: true,
        } as TypeDbInfo;
      });
      wEvGlobalState.next({
        contextStack: [...wEvGlobalState.value.contextStack],
      });
    }
  }
});

EvFinderReady.subscribe((ready) => {
  if (ready) {
    EvUiCmd.next({
      cmd: "listConfig",
      data: { type: ConfigLineType.remoteUrl },
    });

    EvUiCmd.next({
      cmd: "listDbIncluded",
      context: last(
        last(wEvGlobalState.value.contextStack)?.localContexts || []
      ),
    });
  }
});

merge(EvFinderReady, EvFinderState, wEvEventStatus).subscribe(() => {
  if (
    !EvFinderReady.value ||
    !EvFinderState.value.config ||
    wEvEventStatus.value !== WebEventStatus.connected
  ) {
    if (wEvFinderReady.value) wEvFinderReady.next(false);
  } else if (!wEvFinderReady.value) {
    wEvFinderReady.next(true);
  }
});
