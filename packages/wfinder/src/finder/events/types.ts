import { FileInfo } from "../entities/FileInfo";
import { ScanPath } from "../entities/ScanPath";
import { TypeJsonData } from "../../tools/json";
import { ConfigLine } from "../entities/ConfigLine";

export enum FinderState {
  idle,
  scanning,
  searching,
}

export const BUSY_FINDER_STATES = [FinderState.scanning, FinderState.searching];

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
  "size" | "type" | "id" | "dbInfo"
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
};

type TypeMsgStopScan = {
  stopScan: TypeSimpleMsgDef;
};

export type TypeMsgPathItem = Pick<ScanPath, "id" | "path" | "createdAt"> &
  Partial<Pick<ScanPath, "dbInfo">>;

type TypeMsgPathManageDef = {
  // FIXME: TODO: verify dbInfo and remove scanPath on sub databases or remote databases.
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
  "id" | "content" | "updatedAt" | "type"
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
    data: Pick<TypeMsgConfigItem, "dbInfo" | "type" | "content">;
  } & TypeMsgConfigLineDef;
  deleteConfig: {
    data: Pick<TypeMsgConfigItem, "dbInfo" | "type" | "content">;
  } & TypeMsgConfigLineDef;
  listConfig: {
    data: Pick<TypeMsgConfigItem, "type">;
  } & TypeMsgConfigLineDef;
  saveConfig: {
    data: Pick<TypeMsgConfigItem, "type" | "content" | "id" | "dbInfo">;
  } & TypeMsgConfigLineDef;
};

type TypeCmdUiMsgDefMap = TypeMsgScan &
  TypeMsgSearch &
  TypeMsgPathManage &
  TypeMsgStopScan &
  TypeMsgConfigLineManage;

export type TypeCmdUiMsgMap = {
  [key in keyof TypeCmdUiMsgDefMap]: TypeCmdUiMsgDefMap[key] & {
    cmd: key;
    tag?: string | number;
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
  message: string;
  error?: string;
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
