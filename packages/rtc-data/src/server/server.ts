import {
  TypeServerMsg,
  TypeClientMsg,
  TypeMsgP2p,
  TypeP2pDataServer,
  TypeTagList,
} from "./../common/types";
import { ClientInfo } from "./types";
import { createServer } from "http";
import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { v1 as uuidv1 } from "uuid";
import "../common/platform";

/** serve with an exist server */
export function serve(server: HttpServer): void;
/** serve with hostname and port */
export function serve(port?: number, hostname?: string): void;
export function serve(arg: number | HttpServer = 9000, hostname = "0.0.0.0") {
  const httpServer = typeof arg === "number" ? createServer() : arg;
  const io = new Server<TypeServerMsg, TypeClientMsg>(httpServer, {
    cors: { origin: "*" },
  });

  const idMap = new Map<string, ClientInfo>();
  const tagMap = new Map<string, ClientInfo[]>();
  const getTagList = () =>
    Array.from(tagMap).reduce((res: TypeTagList, [tag, info]) => {
      return res.concat(info.map((i) => ({ tag, id: i.id })));
    }, []);
  io.on("connection", (socket) => {
    let id = "";
    while (!id || idMap.has(id)) id = uuidv1();

    socket.on("disconnect", () => {
      const info = idMap.get(id);
      idMap.delete(id);
      if (info?.tag) {
        let infos = tagMap.get(info.tag);
        if (infos) {
          infos = infos.filter((v) => v.id !== id);
          if (!infos.length) tagMap.delete(info.tag);
          else tagMap.set(info.tag, infos);
        }
        socket.broadcast.emit("tagList", getTagList());
      }
    });

    socket.on("init", ({ tag }) => {
      const client: ClientInfo = { id, tag, socket };
      idMap.set(id, client);
      if (tag) {
        const clients = tagMap.get(tag) || [];
        clients.push(client);
        tagMap.set(tag, clients);
        socket.broadcast.emit("tagList", getTagList());
      }
      socket.emit("init", { id, tag });
      if (tagMap.size) socket.emit("tagList", getTagList());
    });
    socket.join("icecandidate");
    const genP2pTransfer = (type: TypeMsgP2p) => ({
      toId,
      data,
    }: TypeP2pDataServer) => {
      idMap.get(toId)?.socket.emit(type, { id, data });
    };
    (["offer", "answer", "icecandidate"] as TypeMsgP2p[]).forEach((type) =>
      socket.on(type, genP2pTransfer(type))
    );
  });

  if (typeof arg === "number") httpServer.listen(arg, hostname);
}
