import { Combine } from "./../common/typeTools";
import { TypeClientEvent } from "./types";
import { RtcSetting } from "./../common/setting";
import { TypeClientMsg, TypeServerMsg, TypeTagList } from "./../common/types";

import { io, Socket } from "socket.io-client";
import "../common/platform";

export class Client {
  serverSock: Socket<TypeClientMsg, TypeServerMsg>;
  id = "";
  tag = "";
  idPeerMap = new Map<string, RTCPeerConnection>();
  idDataChannelMap = new Map<string, RTCDataChannel>();
  peerIdMap = new Map<RTCPeerConnection, string>();
  tagList: TypeTagList = [];
  private idSendDataMap = new Map<string, any[]>();
  a: keyof TypeClientEvent = "connect";
  private cbMap: Partial<
    Combine<
      { [index in keyof TypeClientEvent]: TypeClientEvent[index][] },
      { [index: string]: undefined }
    >
  > = {};
  constructor(server: string, tag?: string) {
    const socket: Socket<TypeClientMsg, TypeServerMsg> = io(server);
    this.serverSock = socket;
    socket.emit("init", { tag });
    socket.once("init", ({ id, tag }) => {
      this.id = id;
      if (tag) this.tag = tag;
      this.cbMap["inited"]?.forEach((cb) => cb());
    });
    socket.on("tagList", (data) => {
      this.tagList = data;
      this.cbMap["tagList"]?.forEach((cb) => cb(data));
    });
    socket.on("offer", (recv) => {
      const pc = new RTCPeerConnection({
        iceServers: RtcSetting.iceServers,
      });
      pc.addEventListener("icecandidate", (ev) =>
        socket.emit("icecandidate", { toId: recv.id, data: ev.candidate })
      );
      pc.setRemoteDescription(recv.data);
      pc.createAnswer().then((answer) => {
        socket.emit("answer", { toId: recv.id, data: answer });
        pc.setLocalDescription(answer);
      });
      pc.ondatachannel = (ev) => {
        ev.channel.addEventListener("open", () => {
          this.idDataChannelMap.set(recv.id, ev.channel);
          ev.channel.addEventListener("close", () =>
            this.idDataChannelMap.delete(recv.id)
          );
        });
        ev.channel.addEventListener("message", (ev) => {
          this.cbMap["data"]?.forEach((cb) => cb(recv.id, ev.data));
        });
      };
      // TODO: 连接断开时清理数据
    });
    socket.on("answer", (data) => {
      this.idPeerMap.get(data.id)?.setRemoteDescription(data.data);
    });
    socket.on("icecandidate", (data) => {
      if (data.data) this.idPeerMap.get(data.id)?.addIceCandidate(data.data);
    });
  }
  connectTo(toId: string) {
    if (this.idDataChannelMap.has(toId)) return this.idDataChannelMap.get(toId);
    const pc = new RTCPeerConnection({
      iceServers: RtcSetting.iceServers,
    });
    pc.addEventListener("icecandidate", (ev) => {
      if (!ev.candidate) return;
      this.serverSock.emit("icecandidate", { toId, data: ev.candidate });
    });
    const dataChannel = pc.createDataChannel("channel");
    dataChannel.addEventListener("open", () => {
      this.idSendDataMap.get(toId)?.forEach((data) => dataChannel.send(data));
    });
    dataChannel.addEventListener("close", () =>
      this.idDataChannelMap.delete(toId)
    );
    pc.createOffer().then((data) => {
      pc.setLocalDescription(data);
      this.serverSock.emit("offer", { toId, data });
    });
    this.idPeerMap.set(toId, pc);
    this.idDataChannelMap.set(toId, dataChannel);
    return dataChannel;
  }
  sendTo(toId: string, data: any) {
    const channel = this.idDataChannelMap.get(toId);
    if (!channel || channel.readyState === "connecting") {
      const datas = this.idSendDataMap.get(toId) || [];
      datas.push(data);
      this.idSendDataMap.set(toId, datas);
      if (channel?.readyState !== "connecting") this.connectTo(toId);
    } else channel.send(data);
  }
  /**
   * @param toId the client ID of connection to be close; If not specified，all connection will be closed;
   */
  close(toId?: string) {
    const close = (id: string) => {
      this.idDataChannelMap.get(id)?.close();
      this.idDataChannelMap.delete(id);
      this.idPeerMap.get(id)?.close();
      this.idPeerMap.delete(id);
    };
    (toId ? [toId] : Array.from(this.idPeerMap.keys())).forEach(close);
  }
  addEventListener<T extends keyof TypeClientEvent>(
    evType: T,
    cb: TypeClientEvent[T]
  ) {
    // @ts-ignore
    const cbs: TypeClientEvent[T][] = this.cbMap[evType] || [];
    cbs.push(cb);
    // @ts-ignore
    if (cbs.length === 1) this.cbMap[evType] = cbs;
  }
  removeEventListener(evType: keyof TypeClientEvent, cb: any) {
    // @ts-ignore
    let cbs: TypeClientEvent[T][] = this.cbMap[evType] || [];
    if (cbs) {
      cbs = cbs.filter((v) => v !== cb);
      this.cbMap[evType] = cbs;
    }
  }
}
