import { Config } from "./../../common";
import { ObjectType } from "typeorm";
import {
  cTypeJsonMoreEntitySpecial,
  cTypeOrmCallDef,
  JsonMoreEntity,
} from "./coreTypes";
import WebSocket from "ws";
import { BehaviorSubject } from "rxjs";
import { TypeDbInfo } from "../../types";
import { genRemoteCaller, genRemoteExector, TypeGateway } from "../eventTools";
import { BaseDbInfoEntity } from "../../entities/BaseDbInfoEntity";
import { ShallowBehaviorSubject } from "../eventLib";
import {
  TypeTransferRemoteStatusMap,
  TypeTransferRemote,
  TypeTransferRemoteStatus,
} from "../types";

export const cEvScanBrake = new BehaviorSubject(false);
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

export type cTypeLinkedRemote = {
  socket?: WebSocket;
  broken?: boolean;
  caller?: cTypeCaller;
  unavailable?: boolean;
  reconnectTimeout?: NodeJS.Timeout;
};

export type cTypeTransferRemote = {
  remoteThumbnail: string;
  socket: WebSocket;
  RemoteStatus: TypeTransferRemoteStatusMap;
  destory: () => void;
  status: TypeTransferRemoteStatus;
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
};

export type CoreFinderState = typeof emptyFinderState;

export const cEvFinderState = new ShallowBehaviorSubject(emptyFinderState);
