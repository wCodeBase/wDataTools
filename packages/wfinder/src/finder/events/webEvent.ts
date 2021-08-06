import { first, isEmpty, isEqual, last } from "lodash";
import { BehaviorSubject, merge, Subject } from "rxjs";
import { joinToAbsolute, ShallowBehaviorSubject } from "wjstools";
import { messageError } from "../../ui/html/uiTools";
import { ConfigLineType, getDbInfoId, TypeDbInfo } from "./../types";
import {
  EvDatabaseInfos,
  EvFileInfoChange,
  EvFinderReady,
  EvFinderState,
  EvUiCmd,
  EvUiCmdResult,
} from "./events";
import { executeUiCmd } from "./eventTools";

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
  loading?: boolean;
};

export const wEvGlobalState = new ShallowBehaviorSubject({
  contextStack: [] as WebContext[],
  total: 0,
  remoteTotal: 0,
  localTotal: 0,
  totalLoading: true,
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
      let contextStack = wEvGlobalState.value.contextStack;
      const context = contextStack.find(
        (v) => getDbInfoId(last(v.localContexts)) === dbId
      );
      if (context) {
        const newRemotes = msg.result.results
          .filter((v) => v.type === ConfigLineType.remoteUrl && !v.disabled)
          .map((v) => v.content);
        if (!isEqual(newRemotes, context.remoteOptionUrls)) {
          contextStack = contextStack.map((v) => {
            return v === context
              ? { ...context, remoteOptionUrls: newRemotes }
              : v;
          });
          wEvGlobalState.next({ contextStack });
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
      let localOptions = context.localOptions || [];
      if (msg.cmd === "listDbIncluded") {
        localOptions = localOptions.filter((v) => v.from !== "DbIncluded");
        msg.result.data.forEach((v) => {
          const finderRoot = parentPath + v.path;
          if (localOptions.find((v) => v.finderRoot === finderRoot)) return;
          localOptions.push({
            finderRoot,
            dbName: v.dbName,
            dbPath: finderRoot + "/" + v.dbName,
            isSubDb: true,
            from: "DbIncluded",
          } as TypeDbInfo);
        });
      } else if (msg.cmd === "listPath") {
        localOptions = localOptions.filter((v) => v.from !== "ScanPath");
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
              from: "ScanPath",
            } as TypeDbInfo);
          }
        });
      }
      wEvGlobalState.next({
        contextStack: [
          ...wEvGlobalState.value.contextStack.slice(0, -1),
          { ...context, localOptions },
        ],
      });
    }
  }
  // Update total file count
  else if (
    msg.cmd === "countAllFileInfo" &&
    !msg.result.error &&
    getDbInfoId(msg.context) === getDbInfoId(getLocalContext())
  ) {
    wEvGlobalState.next({ ...msg.result, totalLoading: false });
  }
});

EvDatabaseInfos.subscribe((state) => {
  if (getLocalContext() === getLocalRootContext()) {
    const { totalFileInfoCount, localFileInfoCount, remoteFileInfoCount } =
      state;
    wEvGlobalState.next({
      ...wEvGlobalState.value,
      total: totalFileInfoCount,
      localTotal: localFileInfoCount,
      remoteTotal: remoteFileInfoCount,
      totalLoading: false,
    });
  }
});

const getTotalFile = () => {
  if (getLocalContext() !== getLocalRootContext()) {
    messageError(
      executeUiCmd("countAllFileInfo", {
        cmd: "countAllFileInfo",
        context: getLocalContext(),
      })
    );
  }
};

EvFileInfoChange.subscribe(() => {
  if (wEvFinderReady.value) getTotalFile();
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
      if (wEvFinderReady.value) {
        wEvFinderReady.next(false);
      }
    } else if (!wEvFinderReady.value) {
      wEvFinderReady.next(true);
    }
  }
);

let prevWebFinderReady: boolean | undefined = undefined;
wEvFinderReady.subscribe((ready) => {
  if (ready === prevWebFinderReady) return;
  prevWebFinderReady = ready;
  if (ready) getTotalFile();
  else wEvGlobalState.next({ totalLoading: true });
});
