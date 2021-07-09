import { FileInfo } from "../entities/FileInfo";
import { ScanPath } from "../entities/ScanPath";
import { TypeJsonData } from "../../tools/json";

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
  exit: "exit",
};

export type TypeUiCmd = keyof typeof UI_CMD_DEF;

export type TypeMsgSearchResultItem = Pick<
  FileInfo,
  "size" | "type" | "id" | "dbRoot"
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

export type TypeMsgPathItem = Pick<
  ScanPath,
  "id" | "path" | "createdAt" | "dbRoot"
>;

type TypeMsgPathManageDef = {
  // FIXME: TODO: verify dbRoot and remove scanPath on sub databases or remote databases.
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

type TypeCmdUiMsgDefMap = TypeMsgScan &
  TypeMsgSearch &
  TypeMsgPathManage &
  TypeMsgStopScan;

export type TypeCmdUiMsgMap = {
  [key in keyof TypeCmdUiMsgDefMap]: TypeCmdUiMsgDefMap[key] & { cmd: key };
};
export type TypeUiMsgDataMap = {
  [key in keyof TypeCmdUiMsgDefMap]: Pick<TypeCmdUiMsgMap[key], "data" | "cmd">;
};
export type TypeUiMsgData = TypeUiMsgDataMap[keyof TypeCmdUiMsgDefMap];
export type TypeUiMsgResultMap = {
  [key in keyof TypeCmdUiMsgDefMap]: Pick<
    TypeCmdUiMsgMap[key],
    "result" | "cmd"
  >;
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
