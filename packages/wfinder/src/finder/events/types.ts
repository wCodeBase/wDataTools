import {
  TypeDefaultSpecialJsonType,
  TypeJsonData,
  TypeSimpleData,
  _TypeJsonData,
} from "./../../tools/json";
import { FileInfo } from "../entities/FileInfo";
import { ScanPath } from "../entities/ScanPath";
import { ConfigLine } from "../entities/ConfigLine";
import { TypeDbInfo } from "../types";
import { DbIncluded } from "../entities/DbIncluded";

export enum FinderStatus {
  idle,
  scanning,
  searching,
}

export const BUSY_FINDER_STATES = [
  FinderStatus.scanning,
  FinderStatus.searching,
];

export const UI_CMD_DEF = {
  search: "search",
  scan: "scan",
  pathManage: "manage scan path",
  fileNameToExclude: "manage file name to exclude",
  fileNameToExcludeChildren: "manage file name to exclude children",
  exit: "exit",
};

export type TypeUiCmd = keyof typeof UI_CMD_DEF;

export type TypeMsgSearchResultItem = Pick<
  FileInfo,
  "size" | "type" | "id" | "dbInfo" | "absPath"
> & { name: string };

type TypeMsgSearch = {
  search: {
    data: {
      keywords: string[];
      skip: number;
      take: number;
    };
    result: {
      records: TypeMsgSearchResultItem[];
      total: number;
      keywords: string[];
      skip: number;
      take: number;
    };
  };
};

type TypeSimpleMsgDef = {
  data: null;
  result: "done";
};

type TypeMsgScan = {
  scan: TypeSimpleMsgDef;
  clearIndexedData: TypeSimpleMsgDef;
};

type TypeMsgStopScan = {
  stopScan: TypeSimpleMsgDef;
};

export type TypeMsgPathItem = Pick<
  ScanPath,
  "id" | "path" | "dbPath" | "createdAt"
> &
  Partial<Pick<ScanPath, "dbInfo">>;

type TypeMsgPathManageDef = {
  data: string[];
  result: {
    results: TypeMsgPathItem[];
    error: string;
  };
};

type TypeMsgPathManage = {
  addPath: TypeMsgPathManageDef;
  deletePath: TypeMsgPathManageDef;
  listPath: TypeMsgPathManageDef;
};

export type TypeMsgConfigItem = Pick<
  ConfigLine,
  "id" | "content" | "updatedAt" | "type" | "createdAt" | "jsonStr" | "disabled"
> &
  Partial<Pick<ConfigLine, "dbInfo">>;

type TypeMsgConfigLineDef = {
  result: {
    results: TypeMsgConfigItem[];
    error: string;
  };
};

type TypeMsgConfigLineManage = {
  addConfig: {
    data: Pick<TypeMsgConfigItem, "dbInfo" | "type" | "content"> &
      Partial<TypeMsgConfigItem>;
  } & TypeMsgConfigLineDef;
  deleteConfig: {
    data: Pick<TypeMsgConfigItem, "dbInfo" | "type" | "content">;
  } & TypeMsgConfigLineDef;
  listConfig: {
    data: Partial<TypeMsgConfigItem>;
  } & {
    result: TypeMsgConfigLineDef["result"] & {
      oriData: Partial<TypeMsgConfigItem>;
    };
  };
  saveConfig: {
    data: Pick<TypeMsgConfigItem, "type" | "dbInfo"> &
      Partial<TypeMsgConfigItem>;
  } & TypeMsgConfigLineDef;
  saveOrCreateConfig: {
    data: Pick<TypeMsgConfigItem, "type" | "dbInfo" | "content"> &
      Partial<TypeMsgConfigItem>;
  } & TypeMsgConfigLineDef;
};

type TypeQueryForInfo = {
  queryUserDataDir: {
    result: string;
  };
};

type TypeMsgRequestUiAction = {
  requestChooseFinderRoot: {
    data: {
      cwd: string;
      currentDatabaseDir?: string;
      userDataDir?: string;
      message?: string;
    };
    result: {
      finderRoot: string;
    };
  };
  requestPickLocalPath: {
    data: {
      cwd?: string;
      title?: string;
      properties?: ("showHiddenFiles" | "createDirectory")[];
      toShotestAbsOrRel?: boolean;
    };
    result: {
      path?: string;
    };
  };
};

type TypeMsgCoreManage = {
  getThumbnail: {
    data: {
      notSubDb: boolean;
    };
    result: string;
  };
};

export type TypeDbIncludedItem = Pick<DbIncluded, "path" | "dbName" | "dbInfo">;

type TypeMsgSubDbManage = {
  listDbIncluded: {
    result: {
      data: TypeDbIncludedItem[];
      error?: string;
    };
  };
};

type TypeCmdUiMsgDefMap = TypeMsgScan &
  TypeMsgSearch &
  TypeMsgPathManage &
  TypeMsgStopScan &
  TypeMsgConfigLineManage &
  TypeMsgRequestUiAction &
  TypeQueryForInfo &
  TypeMsgCoreManage &
  TypeMsgSubDbManage;

export type TypeCmdUiMsgMap = {
  [key in keyof TypeCmdUiMsgDefMap]: TypeCmdUiMsgDefMap[key] & {
    cmd: key;
    tag?: string | number;
    context?: TypeDbInfo;
  };
};
export type TypeUiMsgDataMap = {
  [key in keyof TypeCmdUiMsgDefMap]: Omit<TypeCmdUiMsgMap[key], "result">;
};
export type TypeUiMsgData = TypeUiMsgDataMap[keyof TypeCmdUiMsgDefMap];
export type TypeUiMsgResultMap = {
  [key in keyof TypeCmdUiMsgDefMap]: Omit<TypeCmdUiMsgMap[key], "data">;
};
export type TypeUiMsgResult = TypeUiMsgResultMap[keyof TypeCmdUiMsgDefMap];

export const judgeUiMsgResultType = <T extends keyof TypeCmdUiMsgMap>(
  msg: TypeUiMsgResult,
  cmd: T
): msg is TypeUiMsgResultMap[T] => msg.cmd === cmd;

export type TypeUiMsgMessage = {
  message?: string;
  error?: string;
  warn?: string;
};

export type MsgHeartbeat = {
  cmd: "MsgHeartbeat";
  tag: string | number;
};

export type TypeDatabaseInfos = {
  fileInfoCount: number;
};

export type TypeUiStatus = {
  ink?: boolean;
  electron?: boolean;
  web?: boolean;
};

export type GatewayMessage = {
  label: "GatewayMessage";
  subjectName: string;
  data: TypeJsonData;
  fromMaster: boolean;
};

export type RemoteMessage<K> = {
  label: "RemoteMessage";
  tag: string | number;
  data: _TypeJsonData<K>;
  type: "cmd" | "res";
};

export type RemoteHeartbeat = {
  label: "RemoteHeartbeat";
  tag: string | number;
};

export const isRemoteHeartBeat = (data: any): data is RemoteHeartbeat =>
  data?.label === "RemoteHeartbeat";

export type RemoteError = {
  label: "RemoteError";
  tag: string | number;
  error: string;
};

export const isRemoteError = (data: any): data is RemoteError =>
  data?.label === "RemoteError";

export type TypeCommonMsgContentDef<T> = {
  tag?: string | number;
  data: _TypeJsonData<T>;
  result: _TypeJsonData<T>;
};

export type TypeCommonMsgDef<T> = {
  [key: string]: TypeCommonMsgContentDef<T>;
};

export type ToCommonMsgData<K, T extends TypeCommonMsgDef<K>> = {
  [key in keyof T]: {
    cmd: key;
  } & Omit<T[key], "result">;
};

export type ToCommonMsgDataItem<
  K,
  T extends TypeCommonMsgDef<K>
> = ToCommonMsgData<K, T>[keyof ToCommonMsgData<K, T>];

export type ToCommonMsgResult<K, T extends TypeCommonMsgDef<K>> = {
  [key in keyof T]: {
    cmd: key;
  } & Omit<T[key], "data">;
};

export type ToCommonMsgResultItem<
  K,
  T extends TypeCommonMsgDef<K>
> = ToCommonMsgResult<K, T>[keyof ToCommonMsgResult<K, T>];
export type ToCommonMsgItem<K, T extends TypeCommonMsgDef<K>> =
  | ToCommonMsgResultItem<K, T>
  | ToCommonMsgDataItem<K, T>;

export const isCommonMsgData = <K, T extends TypeCommonMsgDef<K>>(
  data: ToCommonMsgItem<K, T> | TypeSimpleData | Record<string, any>
): data is ToCommonMsgDataItem<K, T> =>
  typeof data === "object" && !!data && "data" in data;
export const isCommonMsgResult = <
  K,
  T extends TypeCommonMsgDef<K>,
  M extends keyof ToCommonMsgData<K, T> = keyof ToCommonMsgData<K, T>
>(
  data: ToCommonMsgData<K, T>[M] | TypeSimpleData | Record<string, any>
): data is ToCommonMsgResult<K, T>[M] =>
  typeof data === "object" && !!data && "result" in data;

export type TypeTransferRemoteStatus = "linking" | "linked" | "broken";

export type TypeTransferRemoteStatusMap = {
  [thumnail: string]: TypeTransferRemoteStatus;
};

export type TypeTransferRemote = {
  dbInfo: TypeDbInfo;
  status: TypeTransferRemoteStatus;
};
