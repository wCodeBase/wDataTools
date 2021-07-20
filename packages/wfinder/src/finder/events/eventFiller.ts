import { last } from "lodash";
import { debounceTime } from "rxjs/operators";
import { getConnection } from "../db";
import { FileInfo } from "../entities/FileInfo";
import { cEvFinderState } from "./core/coreEvents";
import {
  EvDatabaseInfos,
  EvFileInfoChange,
  EvFinderState,
  EvScanPathChange,
  EvUiCmd,
  EvUiCmdResult,
} from "./events";

EvFileInfoChange.subscribe(async () => {
  await getConnection();
  EvDatabaseInfos.next({
    fileInfoCount: await FileInfo.count(),
  });
});

cEvFinderState.subscribe((state) => {
  EvFinderState.next({
    config: last(state.configStack),
  });
});
