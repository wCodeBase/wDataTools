import { Combine } from "./typeTools";
export declare type TypeMsgP2p = 'offer' | 'answer' | 'icecandidate';
export declare type TypeMsg = TypeMsgP2p | 'init' | 'tagList' | 'msg';
export interface TypeP2pDataServer {
    toId: string;
    data: any;
}
export interface TypeP2pDataClient {
    id: string;
    data: any;
}
export declare type TypeTagPair = {
    tag: string;
    id: string;
};
export declare type TypeTagList = TypeTagPair[];
declare type TypeMsgPairsP2p = {
    [index in TypeMsgP2p]: {
        server: TypeP2pDataServer;
        client: TypeP2pDataClient;
    };
};
declare type TypeMsgPairs = Combine<TypeMsgPairsP2p & {
    'init': {
        server: {
            tag?: string;
        };
        client: {
            tag?: string;
            id: string;
        };
    };
    'tagList': {
        server: never;
        client: TypeTagList;
    };
}, {
    [index in TypeMsg]: {
        server: any;
        client: any;
    };
}>;
export declare type TypeServerMsg = {
    [index in keyof TypeMsgPairs]: (data: TypeMsgPairs[index]['server']) => void;
};
export declare type TypeClientMsg = {
    [index in keyof TypeMsgPairs]: (data: TypeMsgPairs[index]['client']) => void;
};
export {};
