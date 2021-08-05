import {
  JsonMore,
  switchEventInSubjects,
  TypeDefaultSpecialJsonType,
  TypeJsonData,
} from "wjstools";
import { TypeDbInfo } from "./../types";
import { ComsumableEvent } from "wjstools";
import * as subjects from "./events";
import { executeRemoteMsg, keepHeartBeat } from "./eventTools";
import {
  isCommonMsgResult,
  ToCommonMsgData,
  ToCommonMsgDataItem,
  ToCommonMsgItem,
  ToCommonMsgResult,
  ToCommonMsgResultItem,
} from "./types";

export const switchEvent = switchEventInSubjects(subjects, JsonMore);

type TypeContextWrappedMsgDef = {
  tran: {
    label: "ContextWrappedMsg";
    data: string;
    tag: string;
    result: {
      data?: string;
      error?: {
        msg: string;
        context: string[];
      };
    };
  };
  switchContext: {
    label: "ContextWrappedMsg";
    data: null;
    tag: string;
    result: {
      data: TypeDbInfo;
      error?: {
        msg: string;
        context: string[];
      };
    };
    context: string[];
  };
};

type _TypeContextWrappedMsgData = ToCommonMsgData<
  TypeDefaultSpecialJsonType,
  TypeContextWrappedMsgDef
>;
type _TypeContextWrappedMsgResult = ToCommonMsgResult<
  TypeDefaultSpecialJsonType,
  TypeContextWrappedMsgDef
>;
type TypeContextWrappedMsgData = ToCommonMsgDataItem<
  TypeDefaultSpecialJsonType,
  TypeContextWrappedMsgDef
>;
type TypeContextWrappedMsgResult = ToCommonMsgResultItem<
  TypeDefaultSpecialJsonType,
  TypeContextWrappedMsgDef
>;
type TypeContextWrappedMsgItem = ToCommonMsgItem<
  TypeDefaultSpecialJsonType,
  TypeContextWrappedMsgDef
>;

type BasicJoinContextPipeProps = {
  onData: (data: string) => Promise<string>;
  forward: (data: string) => void;
};
type NormalJoinContextPipeProps = BasicJoinContextPipeProps & {
  sendToClient: (data: string) => void;
  switchContext: (remoteUrl?: string) => Promise<void>;
  currentConfig: TypeDbInfo;
  isStartJoint?: false;
};
type StartJointContextPipeProps = BasicJoinContextPipeProps & {
  isStartJoint: true;
};

export type TypeJoinContextPipeProps =
  | NormalJoinContextPipeProps
  | StartJointContextPipeProps;

type BasicJoinContextPipeReturn = {
  recieveFromNext: (data: string) => Promise<void>;
  sendData: (
    data: string
  ) => Promise<_TypeContextWrappedMsgResult["tran"] | undefined>;
  destory: () => void;
};
export type NormalJoinContextPipeReturn = BasicJoinContextPipeReturn & {
  recieveFromClient: (data: string) => Promise<void>;
};
export type StartJointContextPipeReturn = BasicJoinContextPipeReturn &
  BasicJoinContextPipeReturn & {
    switchContext: (
      context: string[]
    ) => Promise<_TypeContextWrappedMsgResult["switchContext"]>;
  };

const isNormalJointProps = (
  props: TypeJoinContextPipeProps
): props is NormalJoinContextPipeProps => !props.isStartJoint;

export function joinContextPipe(
  props: NormalJoinContextPipeProps
): NormalJoinContextPipeReturn;
export function joinContextPipe(
  props: StartJointContextPipeProps
): StartJointContextPipeReturn;
export function joinContextPipe(
  props: TypeJoinContextPipeProps
): NormalJoinContextPipeReturn | StartJointContextPipeReturn {
  let destroied = false;
  const { isStartJoint, onData, forward } = props;
  const { sendToClient, switchContext } = {
    sendToClient: () => {
      void 0;
    },
    switchContext: () => {
      void 0;
    },
    ...props,
  };
  let fromClientComsumable = new ComsumableEvent<TypeJsonData>();
  let fromNextComsumable = new ComsumableEvent<TypeJsonData>();
  let currentContext: string[] = [];
  let isContextRemote = false;
  const basicResult: BasicJoinContextPipeReturn = {
    recieveFromNext: async (data: string) => {
      if (destroied) {
        console.warn(" JoinContextPipe recieveFromNext after destoried");
        return;
      }
      try {
        // @ts-ignore
        const packet: TypeContextWrappedMsgItem | undefined =
          JsonMore.parse(data);
        if (!packet || fromNextComsumable.next(packet)) return;
        if (packet.label !== "ContextWrappedMsg") {
          console.warn("Unknown message recieveFromNext: ", data);
          return;
        }
        if (isCommonMsgResult(packet)) {
          if (packet.cmd === "switchContext" || packet.cmd === "tran") {
            throw new Error(
              `Unexpected joinContextPipe packet from next: ${JsonMore.stringify(
                packet
              )}`
            );
          }
          if (!isStartJoint) sendToClient(data);
        } else {
          const heartBeat = keepHeartBeat(forward, packet.tag);
          const recieve = fromClientComsumable.split((v) => v);
          try {
            let res: TypeContextWrappedMsgResult;
            if (packet.cmd === "tran") {
              const { data, ...rest } = packet;
              res = {
                ...rest,
                result: {
                  data: !isStartJoint
                    ? JsonMore.stringify(
                        await executeRemoteMsg<
                          TypeDefaultSpecialJsonType,
                          TypeContextWrappedMsgDef
                        >(packet, sendToClient, recieve, JsonMore, true)
                      )
                    : await onData(data),
                },
              };
            } else if (packet.cmd === "switchContext") {
              throw new Error(
                `Unexpected joinContextPipe packet from next: ${JsonMore.stringify(
                  packet
                )}`
              );
            } else {
              throw new Error(
                `Unhandled joinContextPipe packet: ${JsonMore.stringify(
                  packet
                )}`
              );
            }
            forward(JsonMore.stringify(res));
          } catch (e) {
            const { data, ...rest } = packet;
            try {
              forward(
                JsonMore.stringify({
                  ...rest,
                  result: {
                    error: {
                      msg: String(e),
                      context: currentContext,
                    },
                  },
                } as _TypeContextWrappedMsgResult[typeof packet.cmd])
              );
            } catch (e) {
              console.error("Send error to next failed", e);
            }
          } finally {
            heartBeat.stop();
            recieve.destory();
          }
        }
      } catch (e) {
        console.error("Invalid ContextPipe message from client: ", data);
      }
    },
    sendData: async (data) => {
      const msg: _TypeContextWrappedMsgData["tran"] = {
        label: "ContextWrappedMsg",
        cmd: "tran",
        data,
        tag: Date.now().toString(36) + Math.random().toString(36),
      };
      if (isStartJoint) {
        const recieve = fromNextComsumable.split((v) => v);
        return await executeRemoteMsg<
          TypeDefaultSpecialJsonType,
          TypeContextWrappedMsgDef,
          "tran"
        >(msg, forward, recieve, JsonMore, true).finally(
          recieve.destory.bind(recieve)
        );
      } else {
        const recieve = fromClientComsumable.split((v) => v);
        return await executeRemoteMsg<
          TypeDefaultSpecialJsonType,
          TypeContextWrappedMsgDef,
          "tran"
        >(msg, sendToClient, recieve, JsonMore, true).finally(
          recieve.destory.bind(recieve)
        );
      }
    },
    destory: () => {
      destroied = true;
      fromClientComsumable.destory();
      fromNextComsumable.destory();
    },
  };
  if (!isNormalJointProps(props)) {
    return {
      ...basicResult,
      switchContext: async (context: string[]) => {
        const msg: _TypeContextWrappedMsgData["switchContext"] = {
          label: "ContextWrappedMsg",
          cmd: "switchContext",
          data: null,
          context,
          tag: Date.now().toString(36) + Math.random().toString(36),
        };
        const recieve = fromNextComsumable.split((v) => v);
        const res = await executeRemoteMsg<
          TypeDefaultSpecialJsonType,
          TypeContextWrappedMsgDef,
          "switchContext"
        >(msg, forward, recieve, JsonMore, true).finally(
          recieve.destory.bind(recieve)
        );
        if (res.result.data) {
          res.result.data.remoteUrls = context;
        }
        return res;
      },
    } as StartJointContextPipeReturn;
  } else {
    return {
      ...basicResult,
      recieveFromClient: async (data: string) => {
        if (destroied) {
          console.warn(" JoinContextPipe recieveFromClient after destoried");
          return;
        }
        try {
          // @ts-ignore
          const packet: TypeContextWrappedMsgItem | undefined =
            JsonMore.parse(data);
          if (!packet || fromClientComsumable.next(packet)) return;
          if (packet.label !== "ContextWrappedMsg") {
            console.warn("Unknown message recieveFromClient: ", data);
            return;
          }
          if (isCommonMsgResult(packet)) {
            if (isContextRemote) {
              if (packet.cmd === "switchContext") {
                throw new Error(
                  `Wrong switchContext result direction: ${JsonMore.stringify(
                    packet
                  )}`
                );
              } else if (packet.cmd === "tran") {
                forward(data);
              } else {
                throw new Error(
                  `Unhandled joinContextPipe result packet: ${JsonMore.stringify(
                    packet
                  )}, context: ${JSON.stringify(currentContext)}`
                );
              }
            }
          } else {
            const heartBeat = keepHeartBeat(sendToClient, packet.tag);
            if (packet.cmd === "switchContext") {
              fromClientComsumable.destory();
              fromNextComsumable.destory();
              fromClientComsumable = new ComsumableEvent<TypeJsonData>();
              fromNextComsumable = new ComsumableEvent<TypeJsonData>();
            }
            const recieve = fromNextComsumable.split((v) => v);
            try {
              let res: TypeContextWrappedMsgResult;
              if (packet.cmd === "tran") {
                const { data, ...rest } = packet;
                res = {
                  ...rest,
                  result: {
                    data: isContextRemote
                      ? JsonMore.stringify(
                          await executeRemoteMsg<
                            TypeDefaultSpecialJsonType,
                            TypeContextWrappedMsgDef
                          >(packet, forward, recieve, JsonMore, true)
                        )
                      : await onData(data),
                  },
                };
              } else if (packet.cmd === "switchContext") {
                const { data, ...rest } = packet;
                currentContext = packet.context;
                if (packet.context.length > 0) {
                  const nextPacket = {
                    ...packet,
                    context: packet.context.slice(1),
                  } as typeof packet;
                  const remoteUrl = packet.context[0];
                  if (!remoteUrl)
                    throw new Error(
                      `Invalid reomte context, remoteUrl is empty: ${JsonMore.stringify(
                        nextPacket
                      )}`
                    );
                  await switchContext(remoteUrl);
                  res = await executeRemoteMsg<
                    TypeDefaultSpecialJsonType,
                    TypeContextWrappedMsgDef
                  >(nextPacket, forward, recieve, JsonMore, true);
                  isContextRemote = true;
                } else {
                  await switchContext();
                  res = { ...rest, result: { data: props.currentConfig } };
                  isContextRemote = false;
                }
              } else {
                throw new Error(
                  `Unhandled joinContextPipe packet: ${JsonMore.stringify(
                    packet
                  )}`
                );
              }
              sendToClient(JsonMore.stringify(res));
            } catch (e) {
              const { data, ...rest } = packet;
              try {
                sendToClient(
                  JsonMore.stringify({
                    ...rest,
                    result: {
                      error: {
                        msg: String(e),
                        context: currentContext,
                      },
                    },
                  } as _TypeContextWrappedMsgResult[typeof packet.cmd])
                );
              } catch (e) {
                console.error("Send error to next failed", e);
              }
            } finally {
              heartBeat.stop();
              recieve.destory();
            }
          }
        } catch (e) {
          console.error("Invalid ContextPipe message from client: ", data);
        }
      },
    } as NormalJoinContextPipeReturn;
  }
}
