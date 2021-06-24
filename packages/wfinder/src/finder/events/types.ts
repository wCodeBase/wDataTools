import { FileInfo } from "../entities/FileInfo";
import { ScanPath } from "../entities/ScanPath";

export enum FinderState {
  idle,
  scanning,
  searching,
}

export const UI_CMD_DEF = {
  search: "search",
  scan: "scan",
  pathManage: "manage scan path",
  exit: "exit",
};

export type TypeUiCmd = keyof typeof UI_CMD_DEF;

export type TypeMsg = {
  cmd: string;
  data: any;
  result: any;
};

export type TypeMsgSearchResultItem = Pick<
  FileInfo,
  "name" | "size" | "type" | "id"
>;

export type TypeMsgSearch = {
  cmd: "search";
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

export type TypeMsgScan = {
  cmd: "scan";
  data: null;
  result: "done";
};

export type TypeMsgStopScan = {
  cmd: "stopScan";
  data: null;
  result: "done";
};

export type TypeMsgPathItem = Pick<ScanPath, "id" | "path" | "createdAt">;

export type TypeMsgPathManage = {
  cmd: "addPath" | "deletePath" | "listPath";
  data: string[];
  result: {
    results: TypeMsgPathItem[];
    error: string;
  };
};

export type ToMsgData<T extends TypeMsg> = Pick<T, "cmd" | "data">;
export type ToMsgResult<T extends TypeMsg> = Pick<T, "cmd" | "result">;

export type TypeUiMsgData =
  | ToMsgData<TypeMsgScan>
  | ToMsgData<TypeMsgSearch>
  | ToMsgData<TypeMsgPathManage>
  | ToMsgData<TypeMsgStopScan>;
export type TypeUiMsgResult =
  | ToMsgResult<TypeMsgScan>
  | ToMsgResult<TypeMsgSearch>
  | ToMsgResult<TypeMsgPathManage>
  | ToMsgResult<TypeMsgStopScan>;

export interface TypeUiMsgMessage {
  message: string;
  error?: string;
}

export type TypeDatabaseInfos = {
  fileInfoCount: number;
};
