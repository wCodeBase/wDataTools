"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("./client/client");
const server_1 = require("./server/server");
server_1.serve();
setTimeout(() => {
    client_1.doClient("1");
}, 300);
// setTimeout(() => {
//     doClient("2");
// }, 500);
//# sourceMappingURL=main.js.map