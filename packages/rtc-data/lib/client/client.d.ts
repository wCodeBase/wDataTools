import { TypeClientEvent } from './types';
import { TypeClientMsg, TypeServerMsg, TypeTagList } from './../common/types';
import { Socket } from 'socket.io-client';
import '../common/platform';
export declare class Client {
    serverSock: Socket<TypeClientMsg, TypeServerMsg>;
    id: string;
    tag: string;
    idPeerMap: Map<string, RTCPeerConnection>;
    idDataChannelMap: Map<string, RTCDataChannel>;
    peerIdMap: Map<RTCPeerConnection, string>;
    tagList: TypeTagList;
    private idSendDataMap;
    a: keyof TypeClientEvent;
    private cbMap;
    constructor(server: string, tag?: string);
    connectTo(toId: string): RTCDataChannel | undefined;
    sendTo(toId: string, data: any): void;
    /**
     * @param toId the client ID of connection to be close; If not specified，all connection will be closed;
     */
    close(toId?: string): void;
    addEventListener<T extends keyof TypeClientEvent>(evType: T, cb: TypeClientEvent[T]): void;
    removeEventListener(evType: keyof TypeClientEvent, cb: any): void;
}
export declare const doClient: (tag: string) => void;
