import { Combine } from "./typeTools";

export type TypeMsgP2p = "offer" | "answer" | "icecandidate";

export type TypeMsg = TypeMsgP2p | "init" | "tagList" | "msg";

export interface TypeP2pDataServer {
  toId: string;
  data: any;
}
export interface TypeP2pDataClient {
  id: string;
  data: any;
}

export type TypeTagPair = { tag: string; id: string };
export type TypeTagList = TypeTagPair[];

type TypeMsgPairsP2p = {
  [index in TypeMsgP2p]: {
    server: TypeP2pDataServer;
    client: TypeP2pDataClient;
  };
};

type TypeMsgPairs = Combine<
  TypeMsgPairsP2p & {
    init: {
      server: { tag?: string };
      client: { tag?: string; id: string };
    };
    tagList: {
      server: never;
      client: TypeTagList;
    };
  },
  {
        [index in TypeMsg]: { server: any, client: any } // eslint-disable-line
  }
>;

export type TypeServerMsg = {
  [index in keyof TypeMsgPairs]: (data: TypeMsgPairs[index]["server"]) => void;
};
export type TypeClientMsg = {
  [index in keyof TypeMsgPairs]: (data: TypeMsgPairs[index]["client"]) => void;
};
