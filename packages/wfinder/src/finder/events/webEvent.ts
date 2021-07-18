import { EvFinderReady, EvFinderState, EvUiCmd, EvUiCmdResult } from "./events";
import { ConfigLineType, getDbInfoId, TypeDbInfo } from "./../types";
import { BehaviorSubject, merge } from "rxjs";
import { ShallowBehaviorSubject } from "./eventLib";
import { isEmpty, isEqual } from "lodash";

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

export const wEvFinderReady = new BehaviorSubject<boolean>(false);

EvUiCmdResult.subscribe((msg) => {
  if (msg.cmd === "listConfig" && !msg.result.error) {
    const { type, ...rest } = msg.result.oriData;
    if (type === ConfigLineType.remoteUrl && isEmpty(rest)) {
      if (!wEvFinderReady.value || !EvFinderState.value.config) return;
      const dbId = getDbInfoId(EvFinderState.value.config);
      const context = wEvGlobalState.value.contextStack.find(
        (v) => getDbInfoId(v.localContexts[0]) === dbId
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
  }
});

EvFinderReady.subscribe((ready) => {
  if (ready) {
    EvUiCmd.next({
      cmd: "listConfig",
      data: { type: ConfigLineType.remoteUrl },
    });
  }
});

EvFinderState.subscribe((ev) => console.warn("finder state: ", ev));

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
