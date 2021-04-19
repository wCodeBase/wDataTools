"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doClient = exports.Client = void 0;
const setting_1 = require("./../common/setting");
const socket_io_client_1 = require("socket.io-client");
require("../common/platform");
class Client {
    constructor(server, tag) {
        this.id = '';
        this.tag = '';
        this.idPeerMap = new Map();
        this.idDataChannelMap = new Map();
        this.peerIdMap = new Map();
        this.tagList = [];
        this.idSendDataMap = new Map();
        this.a = 'connect';
        this.cbMap = {};
        const socket = socket_io_client_1.io(server);
        this.serverSock = socket;
        socket.emit('init', { tag });
        socket.once('init', ({ id, tag }) => {
            var _a;
            this.id = id;
            if (tag)
                this.tag = tag;
            (_a = this.cbMap['inited']) === null || _a === void 0 ? void 0 : _a.forEach(cb => cb());
        });
        socket.on('tagList', data => {
            var _a;
            this.tagList = data;
            (_a = this.cbMap['tagList']) === null || _a === void 0 ? void 0 : _a.forEach(cb => cb(data));
        });
        socket.on('offer', recv => {
            const pc = new RTCPeerConnection({
                iceServers: setting_1.RtcSetting.iceServers
            });
            pc.addEventListener('icecandidate', ev => socket.emit('icecandidate', { toId: recv.id, data: ev.candidate }));
            pc.setRemoteDescription(recv.data);
            pc.createAnswer().then(answer => {
                socket.emit('answer', { toId: recv.id, data: answer });
                pc.setLocalDescription(answer);
            });
            pc.ondatachannel = ev => {
                ev.channel.addEventListener('open', () => {
                    this.idDataChannelMap.set(recv.id, ev.channel);
                    ev.channel.addEventListener('close', () => this.idDataChannelMap.delete(recv.id));
                });
                ev.channel.addEventListener('message', ev => {
                    var _a;
                    (_a = this.cbMap['data']) === null || _a === void 0 ? void 0 : _a.forEach(cb => cb(recv.id, ev.data));
                });
            };
            // TODO: 连接断开时清理数据
        });
        socket.on('answer', data => {
            var _a;
            (_a = this.idPeerMap.get(data.id)) === null || _a === void 0 ? void 0 : _a.setRemoteDescription(data.data);
        });
        socket.on("icecandidate", data => {
            var _a;
            if (data.data)
                (_a = this.idPeerMap.get(data.id)) === null || _a === void 0 ? void 0 : _a.addIceCandidate(data.data);
        });
    }
    connectTo(toId) {
        if (this.idDataChannelMap.has(toId))
            return this.idDataChannelMap.get(toId);
        const pc = new RTCPeerConnection({
            iceServers: setting_1.RtcSetting.iceServers
        });
        pc.addEventListener('icecandidate', ev => {
            if (!ev.candidate)
                return;
            this.serverSock.emit("icecandidate", { toId, data: ev.candidate });
        });
        const dataChannel = pc.createDataChannel('channel');
        dataChannel.addEventListener('open', () => {
            var _a;
            (_a = this.idSendDataMap.get(toId)) === null || _a === void 0 ? void 0 : _a.forEach(data => dataChannel.send(data));
        });
        dataChannel.addEventListener('close', () => this.idDataChannelMap.delete(toId));
        pc.createOffer().then(data => {
            pc.setLocalDescription(data);
            this.serverSock.emit('offer', { toId, data });
        });
        this.idPeerMap.set(toId, pc);
        this.idDataChannelMap.set(toId, dataChannel);
        return dataChannel;
    }
    sendTo(toId, data) {
        const channel = this.idDataChannelMap.get(toId);
        if (!channel || channel.readyState === 'connecting') {
            const datas = this.idSendDataMap.get(toId) || [];
            datas.push(data);
            this.idSendDataMap.set(toId, datas);
            if ((channel === null || channel === void 0 ? void 0 : channel.readyState) !== 'connecting')
                this.connectTo(toId);
        }
        else
            channel.send(data);
    }
    /**
     * @param toId the client ID of connection to be close; If not specified，all connection will be closed;
     */
    close(toId) {
        const close = (id) => {
            var _a, _b;
            (_a = this.idDataChannelMap.get(id)) === null || _a === void 0 ? void 0 : _a.close();
            this.idDataChannelMap.delete(id);
            (_b = this.idPeerMap.get(id)) === null || _b === void 0 ? void 0 : _b.close();
            this.idPeerMap.delete(id);
        };
        (toId ? [toId] : Array.from(this.idPeerMap.keys())).forEach(close);
    }
    addEventListener(evType, cb) {
        // @ts-ignore
        let cbs = this.cbMap[evType] || [];
        cbs.push(cb);
        // @ts-ignore
        if (cbs.length === 1)
            this.cbMap[evType] = cbs;
    }
    removeEventListener(evType, cb) {
        // @ts-ignore
        let cbs = this.cbMap[evType] || [];
        if (cbs) {
            cbs = cbs.filter(v => v !== cb);
            this.cbMap[evType] = cbs;
        }
    }
}
exports.Client = Client;
exports.doClient = (tag) => {
    const client = new Client("http://127.0.0.1:9000", 'server');
    client.addEventListener('connect', id => {
        client.sendTo(id, "msg from client: " + client.id);
    });
    client.addEventListener('data', (id, data) => {
        console.log(data);
        client.sendTo(id, "server echo");
    });
    const client1 = new Client("http://127.0.0.1:9000");
    client1.addEventListener('tagList', (tagList) => {
        tagList.forEach(t => client1.sendTo(t.id, Buffer.from("aabbcc")));
    });
};
//# sourceMappingURL=client.js.map