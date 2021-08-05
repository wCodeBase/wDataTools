import { Server } from "http";
import { BehaviorSubject, Subject } from "rxjs";
import { ObjectType } from "typeorm";
import WebSocket from "ws";
import { BaseDbInfoEntity } from "../../entities/BaseDbInfoEntity";
import { TypeDbInfo } from "../../types";
import { JsonSubject, ShallowBehaviorSubject } from "wjstools";
import { genRemoteCaller, genRemoteExector } from "../eventTools";
import {
  TypeLinkedRemoteItem,
  TypeTransferRemoteStatus,
  TypeTransferRemoteStatusMap,
} from "../types";
import {
  cTypeJsonMoreEntitySpecial,
  cTypeOrmCallDef,
  JsonMoreEntity,
} from "./coreTypes";

export const cEvScanBrake = new BehaviorSubject<{
  [absPath: string]: TypeDbInfo;
}>({});
const callTpl = genRemoteCaller<cTypeJsonMoreEntitySpecial, cTypeOrmCallDef>(
  () => {
    void 0;
  },
  JsonMoreEntity
);
export type cTypeCaller = typeof callTpl;
const executorTpl = genRemoteExector<
  cTypeJsonMoreEntitySpecial,
  cTypeOrmCallDef
>(() => {
  void 0;
}, JsonMoreEntity);
export type cTypeExecutor = typeof executorTpl;

export type cTypeLinkedRemote = TypeLinkedRemoteItem & {
  socket?: WebSocket;
  caller?: cTypeCaller;
  reconnectTimeout?: NodeJS.Timeout;
};

export type cTypeTransferRemote = {
  remoteThumbnail: string;
  socket: WebSocket;
  RemoteStatus: TypeTransferRemoteStatusMap;
  destory: () => void;
  status: TypeTransferRemoteStatus;
};

export type cTypeServerState = {
  error?: string;
  server?: Server;
  connecting?: boolean;
};

const emptyFinderState = {
  configStack: [] as TypeDbInfo[],
  configIndex: 0,
  remoteMethodsServe: true,
  linkedRemote: {} as {
    [remoteUrl: string]: cTypeLinkedRemote;
  },
  remoteMethodServeEntityMap: {} as Record<
    string,
    ObjectType<BaseDbInfoEntity>
  >,
  serverState: {} as { [address: string]: cTypeServerState },
};

export type CoreFinderState = typeof emptyFinderState;

export const cEvFinderState = new ShallowBehaviorSubject(emptyFinderState);

export const cEvConfigLineChange = new JsonSubject<TypeDbInfo | null>();

export const cEvScanPathChange = new JsonSubject<TypeDbInfo | null>();
export const cEvDbIncludedChange = new JsonSubject<TypeDbInfo | null>();

export const cEvRefreshRemote = new Subject<void>();
