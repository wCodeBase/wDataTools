import {
  EVENT_ORM_METHOD_WEBSOCKET_ROUTE,
  EVENT_TRANSFER_WEBSOCKET_ROUTE,
} from "./../../constants";
import * as express from "express";
import WebSocket from "ws";
import * as http from "http";
import * as path from "path";
import { HttpServerOption } from "../types";
import { isDev } from "../common";
import { localhost } from "../../constants";
import { EVENT_WEBSOCKET_ROUTE } from "../../constants";
import { joinContextPipe, switchEvent } from "../events/eventGateway";
import { cEvFinderState } from "../events/core/coreEvents";
import { genRemoteExector, TypeGateway } from "../events/eventTools";
import {
  cTypeJsonMoreEntitySpecial,
  cTypeOrmCallDef,
  JsonMoreEntity,
} from "../events/core/coreTypes";
import { getFinderCoreInfo } from "../db";
import { EvUiLaunched } from "../events/events";
import { Config } from "../common";
import { waitWsConnected } from "../events/core/coreState";

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
        socket.onclose = gateway.destory;
      });
    } else if (request.url === EVENT_TRANSFER_WEBSOCKET_ROUTE) {
      let nextSocket: WebSocket | undefined;
      wss.handleUpgrade(request, socket, head, (socket, request) => {
        let gateway: TypeGateway | undefined;
        const joint = joinContextPipe({
          isStartJoint: false,
          currentConfig: Config,
          onData: async (data) => {
            gateway?.receive(data);
            return "";
          },
          forward: (data) => {
            nextSocket?.send(data);
          },
          sendToClient: (data) => {
            socket.send(data);
          },
          switchContext: async (url) => {
            if (
              nextSocket &&
              ([nextSocket.CLOSED, nextSocket.CLOSING] as number[]).includes(
                nextSocket.readyState
              )
            ) {
              const toClose = nextSocket;
              nextSocket = undefined;
              toClose.close();
            }
            if (gateway) {
              gateway.destory();
              gateway = undefined;
            }
            if (url) {
              const doConnect = async () => {
                const newNext = await waitWsConnected(
                  url + EVENT_TRANSFER_WEBSOCKET_ROUTE,
                  true
                );
                nextSocket = newNext;
                const close = nextSocket.close.bind(nextSocket);
                nextSocket.close = () => {
                  if (nextSocket === newNext) nextSocket = undefined;
                  close();
                };
                newNext.onclose = () => {
                  setTimeout(() => {
                    if (nextSocket === newNext) doConnect();
                  }, 500);
                };
                newNext.onmessage = (ev) => {
                  joint.recieveFromNext(String(ev.data));
                };
              };
              await doConnect();
            } else {
              gateway = switchEvent((data) => {
                joint.sendData(data).catch((e) => {
                  console.warn("Joint sendData failed:", e);
                });
              }, true);
            }
          },
        });
        socket.on("message", joint.recieveFromClient);
        socket.onclose = () => {
          gateway?.destory();
          gateway = undefined;
          joint.destory();
          nextSocket?.close();
        };
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
    } else {
      wss.handleUpgrade(request, socket, head, (socket, request) => {
        socket.close();
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
