import * as express from "express";
import * as WebSocket from "ws";
import * as http from "http";
import * as path from "path";
import { HttpServerOption } from "../types";
import { isDev } from "../../ui/electron/common";
import { localhost } from "../../constants";
import { EVENT_WEBSOCKET_ROUTE } from "../../constants";
import { switchEvent } from "../events/eventGateway";

export const createHttpServer = async (options: HttpServerOption) => {
  const app = express.default();
  let staticSetted = false;
  const staticRoute = "/";
  if (isDev) {
    try {
      const { devServerPort } = require("../../../webpack-configs/setting.js");
      const { createProxyMiddleware } = require("http-proxy-middleware");
      app.use(
        staticRoute,
        createProxyMiddleware({
          target: `http://${localhost}:${devServerPort}/`,
          changeOrigin: true,
        })
      );
      staticSetted = true;
    } catch (e) {
      console.error("Proxy to devServer failed", e);
    }
  }
  if (!staticSetted) {
    app.use(staticRoute, express.static(path.join(__dirname, "../../ui/html")));
    staticSetted = true;
  }
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    if (request.url === EVENT_WEBSOCKET_ROUTE) {
      wss.handleUpgrade(request, socket, head, (socket, request) => {
        const gateway = switchEvent((data) => socket.send(data), true);
        socket.on("message", gateway.receive);
        socket.onclose = gateway.unsubscribe;
      });
    }
  });
  await new Promise<void>((res, rej) => {
    server.once("error", (err) => rej(err));
    server.listen(options.port, options.host, undefined, () => res());
  });
  return server;
};
