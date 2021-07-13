import { EVENT_ORM_METHOD_WEBSOCKET_ROUTE } from "./../../constants";
import * as express from "express";
import * as WebSocket from "ws";
import * as http from "http";
import * as path from "path";
import { HttpServerOption } from "../types";
import { isDev } from "../../ui/electron/common";
import { localhost } from "../../constants";
import { EVENT_WEBSOCKET_ROUTE } from "../../constants";
import { switchEvent } from "../events/eventGateway";
import { cEvFinderState } from "../events/core/coreEvents";
import { genRemoteExector } from "../events/eventTools";
import {
  cTypeJsonMoreEntitySpecial,
  cTypeOrmCallDef,
  JsonMoreEntity,
} from "../events/core/coreTypes";
import { getFinderCoreInfo } from "../db";
import { EvUiLaunched } from "../events/events";

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
  const ormSocketSet = new Set<WebSocket>();
  const finderStateSubscribe = cEvFinderState.subscribe((state) => {
    if (!state.remoteMethodsServe) {
      Array.from(ormSocketSet).forEach((v) => v.close());
      ormSocketSet.clear();
    }
  });
  server.addListener("close", () => {
    finderStateSubscribe.unsubscribe();
    EvUiLaunched.next({ web: false });
  });
  server.on("upgrade", (request, socket, head) => {
    if (request.url === EVENT_WEBSOCKET_ROUTE) {
      wss.handleUpgrade(request, socket, head, (socket, request) => {
        const gateway = switchEvent((data) => socket.send(data), true);
        socket.on("message", gateway.receive);
        socket.onclose = gateway.unsubscribe;
      });
    } else if (request.url === EVENT_ORM_METHOD_WEBSOCKET_ROUTE) {
      wss.handleUpgrade(request, socket, head, (socket, request) => {
        if (!cEvFinderState.value.remoteMethodsServe) socket.close();
        else {
          const executor = genRemoteExector<
            cTypeJsonMoreEntitySpecial,
            cTypeOrmCallDef
          >(
            (data) => socket.send(data),
            JsonMoreEntity
          )(async (data) => {
            if (data.cmd === "callOrmMethod") {
              const dbThumnail = (await getFinderCoreInfo()).thumnail;
              if (data.data.queryLimit.dbThumnailStack.includes(dbThumnail))
                throw new Error(
                  `callOrmMethod failed, conflict in finder stack: ${dbThumnail}`
                );
              const entity =
                cEvFinderState.value.remoteMethodServeEntityMap[
                  data.data.entityName
                ];
              if (!entity)
                throw new Error(
                  `callOrmMethod failed, entity not registered: ${data.data.entityName}`
                );
              // @ts-ignore
              // eslint-disable-next-line
              const method: Function = entity[data.data.method];
              if (typeof method !== "function")
                throw new Error(
                  `callOrmMethod failed, method not found: ${data.data.method}`
                );
              const res = await method.call(
                entity,
                ...data.data.args,
                data.data.queryLimit
              );
              return res;
            }
          });
          socket.on("message", executor.recieve);
        }
      });
    }
  });
  await new Promise<void>((res, rej) => {
    server.once("error", (err) => rej(err));
    server.listen(options.port, options.host, undefined, () => res());
  });
  EvUiLaunched.next({ web: true });
  return server;
};
