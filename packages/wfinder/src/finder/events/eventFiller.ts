import { last, pick } from "lodash";
import { debounceTime } from "rxjs/operators";
import { Config } from "../common";
import { getConfig, getConnection } from "../db";
import { FileInfo } from "../entities/FileInfo";
import {
  cEvConfigLineChange,
  cEvDbIncludedChange,
  cEvFinderState,
  cEvScanPathChange,
} from "./core/coreEvents";
import {
  EvDatabaseInfos,
  EvFileInfoChange,
  EvFinderState,
  EvUiCmd,
  EvUiCmdResult,
} from "./events";
import { LinkedRemoteItemKeys, TypeLinkedRemote } from "./types";
import { uiCmdExecutor } from "./uiCmdExecutor";

EvFileInfoChange.subscribe(async () => {
  await getConnection();
  EvDatabaseInfos.next({
    fileInfoCount: await FileInfo.count(),
  });
});

cEvFinderState.subscribe((state) => {
  EvFinderState.next({
    config: last(state.configStack),
    remotes: Object.entries(state.linkedRemote).reduce((res, [key, value]) => {
      res[key] = pick(value, LinkedRemoteItemKeys);
      return res;
    }, {} as TypeLinkedRemote),
  });
});

cEvConfigLineChange.subscribe((context) => {
  uiCmdExecutor({ cmd: "listConfig", data: {}, context: context || Config });
});
cEvDbIncludedChange.subscribe((context) => {
  uiCmdExecutor({ cmd: "listDbIncluded", context: context || Config });
});
cEvScanPathChange.subscribe((context) => {
  uiCmdExecutor({ cmd: "listPath", data: [], context: context || Config });
});
