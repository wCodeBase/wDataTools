import { ObjectType } from "typeorm";
import { cTypeJsonMoreEntitySpecial, cTypeOrmCallDef } from "./coreTypes";
import WebSocket from "ws";
import { BehaviorSubject } from "rxjs";
import { TypeDbInfo } from "../../types";
import {
  genRemoteCaller,
  genRemoteExector,
  ShallowBehaviorSubject,
} from "../eventTools";
import { BaseDbInfoEntity } from "../../entities/BaseDbInfoEntity";

export const cEvScanBrake = new BehaviorSubject(false);
const callTpl = genRemoteCaller<cTypeJsonMoreEntitySpecial, cTypeOrmCallDef>(
  () => {
    void 0;
  }
);
export type cTypeCaller = typeof callTpl;
const executorTpl = genRemoteExector<
  cTypeJsonMoreEntitySpecial,
  cTypeOrmCallDef
>(() => {
  void 0;
});
export type cTypeExecutor = typeof executorTpl;

export type cTypeLinkedRemote = {
  socket?: WebSocket;
  broken?: boolean;
  caller?: cTypeCaller;
  unavailable?: boolean;
  reconnectTimeout?: NodeJS.Timeout;
};

const emptyFinderState = {
  configStack: [] as TypeDbInfo[],
  linkedRemote: {} as {
    [remoteUrl: string]: cTypeLinkedRemote;
  },
  remoteMethodsServe: true,
  remoteMethodServeEntityMap: {} as Record<
    string,
    ObjectType<BaseDbInfoEntity>
  >,
};

export type CoreFinderState = typeof emptyFinderState;

export const cEvFinderState = new ShallowBehaviorSubject(emptyFinderState);
