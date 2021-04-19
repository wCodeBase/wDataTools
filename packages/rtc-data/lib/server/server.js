"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serve = void 0;
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const uuid_1 = require("uuid");
require("../common/platform");
exports.serve = () => {
    const httpServer = http_1.createServer();
    const io = new socket_io_1.Server(httpServer, { cors: { origin: '*' } });
    const idMap = new Map();
    const tagMap = new Map();
    const getTagList = () => Array.from(tagMap).reduce((res, [tag, info]) => {
        return res.concat(info.map(i => ({ tag, id: i.id })));
    }, []);
    io.on("connection", (socket) => {
        let id = '';
        while (!id || idMap.has(id))
            id = uuid_1.v1();
        socket.on('disconnect', () => {
            const info = idMap.get(id);
            idMap.delete(id);
            if (info === null || info === void 0 ? void 0 : info.tag) {
                let infos = tagMap.get(info.tag);
                if (infos) {
                    infos = infos.filter(v => v.id !== id);
                    if (!infos.length)
                        tagMap.delete(info.tag);
                    else
                        tagMap.set(info.tag, infos);
                }
                socket.broadcast.emit('tagList', getTagList());
            }
        });
        socket.on('init', ({ tag }) => {
            const client = { id, tag, socket };
            idMap.set(id, client);
            if (tag) {
                const clients = tagMap.get(tag) || [];
                clients.push(client);
                tagMap.set(tag, clients);
                socket.broadcast.emit('tagList', getTagList());
            }
            socket.emit('init', { id, tag });
            if (tagMap.size)
                socket.emit('tagList', getTagList());
        });
        socket.join('icecandidate');
        const genP2pTransfer = (type) => ({ toId, data }) => {
            var _a;
            (_a = idMap.get(toId)) === null || _a === void 0 ? void 0 : _a.socket.emit(type, { id, data });
        };
        ['offer', 'answer', 'icecandidate'].forEach(type => socket.on(type, genP2pTransfer(type)));
    });
    httpServer.listen(9000);
};
//# sourceMappingURL=server.js.map