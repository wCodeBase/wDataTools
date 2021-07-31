import { last, pick } from "lodash";
import { getIpAddressList } from "../../tools/nodeTool";
import { Config } from "../common";
import { switchDb } from "../db";
import { FileInfo } from "../entities/FileInfo";
import { watchServerSettings } from "./../server/httpServer";
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
  EvUiLaunched,
} from "./events";
import {
  LinkedRemoteItemKeys,
  TypeLinkedRemote,
  TypeServerState,
} from "./types";
import { uiCmdExecutor } from "./uiCmdExecutor";

cEvScanPathChange.subscribe((v) => EvFileInfoChange.next(v));
cEvDbIncludedChange.subscribe((v) => EvFileInfoChange.next(v));

EvFileInfoChange.subscribe(async () => {
  EvDatabaseInfos.next({
    fileInfoCount: await switchDb(Config, () =>
      FileInfo.countAllSubDatabases()
    ),
  });
});

cEvFinderState.subscribe((state) => {
  EvFinderState.next({
    config: last(state.configStack),
    remotes: Object.entries(state.linkedRemote).reduce((res, [key, value]) => {
      res[key] = pick(value, LinkedRemoteItemKeys);
      return res;
    }, {} as TypeLinkedRemote),
    servers: Object.entries(state.serverState).reduce((res, [key, state]) => {
      const { server, ...rest } = state;
      res[key] = rest;
      return res;
    }, {} as TypeServerState),
    osInfo: {
      systemIps: getIpAddressList(),
    },
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

const uiLaunchSub = EvUiLaunched.subscribe((v) => {
  if (v.electron)
    process.nextTick(() => {
      uiLaunchSub.unsubscribe();
      watchServerSettings();
    });
});
