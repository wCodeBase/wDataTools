import { EvFinderReady, EvFinderState, EvUiCmd, EvUiCmdResult } from "./events";
import {
  ConfigLineType,
  getDbInfoId,
  getLocalDbInfoStackId,
  TypeDbInfo,
} from "./../types";
import { BehaviorSubject, merge, Subject } from "rxjs";
import { ShallowBehaviorSubject } from "./eventLib";
import { first, isEmpty, isEqual, last } from "lodash";
import { joinToAbsolute } from "../../tools/pathTool";

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

export const getLocalRootContext = () =>
  first(last(wEvGlobalState.value.contextStack)?.localContexts);

export const wEvFinderReady = new BehaviorSubject<boolean>(false);

export const wEvLocalDbContextChange = new Subject<void>();

EvUiCmdResult.subscribe((msg) => {
  // Update remote context options
  if (msg.cmd === "listConfig" && !msg.result.error) {
    const { type, ...rest } = msg.result.oriData;
    if (!type || (type === ConfigLineType.remoteUrl && isEmpty(rest))) {
      if (!wEvFinderReady.value || !EvFinderState.value.config) return;
      const dbId = getDbInfoId(msg.context);
      const context = wEvGlobalState.value.contextStack.find(
        (v) => getDbInfoId(last(v.localContexts)) === dbId
      );
      if (context) {
        const newRemotes = msg.result.results
          .filter((v) => v.type === ConfigLineType.remoteUrl && !v.disabled)
          .map((v) => v.content);
        if (!isEqual(newRemotes, context.remoteOptionUrls)) {
          context.remoteOptionUrls = newRemotes;
          wEvGlobalState.next({
            contextStack: [...wEvGlobalState.value.contextStack],
          });
        }
      }
    }
  }
  // Update sub-database or ScanPath external database context options
  else if (
    (msg.cmd === "listDbIncluded" || msg.cmd === "listPath") &&
    !msg.result.error
  ) {
    if (wEvEventStatus.value !== WebEventStatus.connected) return;
    const context = last(wEvGlobalState.value.contextStack);
    if (!context) return;
    const lastLocal = last(context.localContexts);
    if (!lastLocal) return;
    if (getDbInfoId(lastLocal) === getDbInfoId(msg.context)) {
      const parentPath = lastLocal.dbPath.slice(0, -lastLocal.dbName.length);
      const localOptions = context.localOptions || [];
      if (msg.cmd === "listDbIncluded") {
        msg.result.data.forEach((v) => {
          const finderRoot = parentPath + v.path;
          if (localOptions.find((v) => v.finderRoot === finderRoot)) return;
          localOptions.push({
            finderRoot,
            dbName: v.dbName,
            dbPath: finderRoot + "/" + v.dbName,
            isSubDb: true,
          } as TypeDbInfo);
        });
      } else if (msg.cmd === "listPath") {
        msg.result.results.forEach((v) => {
          const { dbPath } = v;
          if (dbPath) {
            const finderRoot = joinToAbsolute(parentPath, v.path);
            if (localOptions.find((v) => v.finderRoot === finderRoot)) return;
            localOptions.push({
              finderRoot,
              dbName: lastLocal.dbName,
              dbPath: joinToAbsolute(parentPath, dbPath),
              isSubDb: true,
            } as TypeDbInfo);
          }
        });
      }
      context.localOptions = localOptions;
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
      context: getLocalContext(),
    });

    EvUiCmd.next({
      cmd: "listDbIncluded",
      context: getLocalContext(),
    });
  }
});

merge(EvFinderReady, EvFinderState, wEvEventStatus, wEvGlobalState).subscribe(
  () => {
    if (
      !EvFinderReady.value ||
      !EvFinderState.value.config ||
      wEvEventStatus.value !== WebEventStatus.connected ||
      !getLocalContext()
    ) {
      if (wEvFinderReady.value) wEvFinderReady.next(false);
    } else if (!wEvFinderReady.value) {
      wEvFinderReady.next(true);
    }
  }
);
