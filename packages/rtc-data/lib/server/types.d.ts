import { Socket } from "socket.io";
export interface ClientInfo {
    id: string;
    tag?: string;
    socket: Socket;
}
