import compression from "compression";
import * as express from "express";
import * as http from "http";
import { isEmpty } from "lodash";
import { Socket } from "net";
import * as path from "path";
import WebSocket from "ws";
import { EVENT_WEBSOCKET_ROUTE, localhost } from "../../constants";
import { JsonMore } from "../../tools/json";
import { concatUrls, parseAddress } from "../../tools/tool";
import { Config, isDev } from "../common";
import { getFinderCoreInfo, switchDb } from "../db";
import { cEvFinderState, cTypeServerState } from "../events/core/coreEvents";
import { waitWsConnected } from "../events/core/coreState";
import {
  cTypeJsonMoreEntitySpecial,
  cTypeOrmCallDef,
  JsonMoreEntity,
} from "../events/core/coreTypes";
import { joinContextPipe, switchEvent } from "../events/eventGateway";
import { EvUiCmdResult, EvUiLaunched } from "../events/events";
import { genRemoteExector, TypeGateway } from "../events/eventTools";
import { uiCmdExecutor } from "../events/uiCmdExecutor";
import {
  ConfigLineType,
  defaultServerSetting,
  getDbInfoId,
  HttpServerOption,
  TypeServerSetting,
} from "../types";
import {
  EVENT_ORM_METHOD_WEBSOCKET_ROUTE,
  EVENT_TRANSFER_WEBSOCKET_ROUTE,
} from "./../../constants";
import { execRoot } from "./../../env";

const compressor = compression();

type serverSetting = TypeServerSetting & { ipRegexps: RegExp[] };
const getGlobalSettings = (() => {
  let setting: serverSetting | undefined;
  let error: any;
  let promises: {
    res: (data: serverSetting) => void;
    rej: (err: any) => void;
  }[] = [];
  uiCmdExecutor({
    cmd: "listConfig",
    data: { type: ConfigLineType.serverSetting },
  });
  EvUiCmdResult.subscribe((msg) => {
    if (
      msg.cmd === "listConfig" &&
      !msg.result.error &&
      (msg.result.oriData.type === ConfigLineType.serverSetting ||
        isEmpty(msg.result.oriData)) &&
      getDbInfoId(msg.context) === getDbInfoId(Config)
    ) {
      if (msg.result.error) {
        if (!setting) {
          error = msg.result.error;
          promises.forEach((v) => v.rej(error));
          promises = [];
        }
      } else {
        try {
          const config = msg.result.results.filter(
            (v) => v.type === ConfigLineType.serverSetting
          )[0];
          const rawSetting = config?.jsonStr
            ? (JsonMore.parse(config.jsonStr) as TypeServerSetting)
            : defaultServerSetting;
          const newSetting = {
            ...rawSetting,
            ipRegexps: rawSetting.allowIps.map((v) => new RegExp(v)),
          };
          setting = newSetting;
          promises.forEach((v) => v.res(newSetting));
          promises = [];
        } catch (e) {
          error = e;
          promises.forEach((v) => v.rej(error));
          promises = [];
        }
      }
    }
  });
  return () =>
    new Promise<serverSetting>((res, rej) => {
      if (setting) res(setting);
      else if (error) rej(error);
      else {
        promises.push({ res, rej });
      }
    });
})();

const filterIp = async (
  ip: string | undefined,
  getSettings: typeof getGlobalSettings
) => {
  if (!ip) return false;
  const setting = await getSettings();
  return !!setting.ipRegexps.find((v) => v.test(ip));
};

export const createHttpServer = async (
  _options: HttpServerOption | string,
  cliServer = true,
  isolateSetting?: TypeServerSetting
) => {
  const options =
    typeof _options === "string" ? parseAddress(_options) : _options;
  const currentAddress = options.host + ":" + options.port;
  if (
    cEvFinderState.value.serverState[currentAddress]?.connecting ||
    cEvFinderState.value.serverState[currentAddress]?.server
  )
    throw new Error("Create http server conflict: " + currentAddress);
  cEvFinderState.value.serverState[currentAddress] = { connecting: true };
  try {
    const app = express.default();
    const mGetSettings = isolateSetting
      ? (() => {
          const setting = {
            ...isolateSetting,
            ipRegexps: isolateSetting.allowIps.map((v) => new RegExp(v)),
          };
          return async () => setting;
        })()
      : getGlobalSettings;
    app.all("/*", async (req, res, next) => {
      if (!(await filterIp(req.ip, mGetSettings))) {
        res.statusCode = 403;
        res.send("403 forbidden");
      } else {
        next();
      }
    });
    let staticSetted = false;
    const staticRoute = "/";
    if (isDev) {
      try {
        const {
          devServerPort,
        } = require("../../../webpack-configs/setting.js");
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
      app.use(staticRoute, compressor);
      app.use(staticRoute, express.static(path.join(execRoot, "ui/html")));
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
    server.on(
      "upgrade",
      async (request: http.IncomingMessage, socket: Socket, head) => {
        if (!(await filterIp(socket.remoteAddress, mGetSettings))) {
          socket.destroy();
        } else if (request.url === EVENT_WEBSOCKET_ROUTE) {
          wss.handleUpgrade(request, socket, head, (socket) => {
            const gateway = switchEvent((data) => socket.send(data), true);
            socket.on("message", gateway.receive);
            socket.onclose = gateway.destory;
          });
        } else if (request.url === EVENT_TRANSFER_WEBSOCKET_ROUTE) {
          let nextSocket: WebSocket | undefined;
          wss.handleUpgrade(request, socket, head, (socket) => {
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
                  (
                    [nextSocket.CLOSED, nextSocket.CLOSING] as number[]
                  ).includes(nextSocket.readyState)
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
                      concatUrls(url, EVENT_TRANSFER_WEBSOCKET_ROUTE),
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
          wss.handleUpgrade(request, socket, head, (socket) => {
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
                  const dbThumbnail = (await getFinderCoreInfo()).thumbnail;
                  if (
                    data.data.queryLimit.dbThumbnailStack.includes(dbThumbnail)
                  )
                    throw new Error(
                      `callOrmMethod failed, conflict in finder stack with thumbnail: ${dbThumbnail}`
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
                  const res: any = await switchDb(Config, () =>
                    method.call(entity, ...data.data.args, data.data.queryLimit)
                  );
                  return res;
                }
              });
              socket.on("message", executor.recieve);
            }
          });
        } else {
          socket.destroy();
        }
      }
    );
    const updateServerState = async (state: cTypeServerState) => {
      const setting = await mGetSettings();
      if (
        !cliServer &&
        !setting.bindAddressList.find((v) => v === currentAddress)
      ) {
        state.server?.close();
        return;
      }
      const { serverState } = cEvFinderState.value;
      serverState[currentAddress]?.server?.close();
      serverState[currentAddress] = state;
      if (cliServer) cEvFinderState.next({ serverState: { ...serverState } });
    };
    await Promise.all([
      new Promise<void>((res, rej) => {
        server.once("error", (err) => {
          updateServerState({ error: String(err) });
          rej(err);
        });
        server.listen(options.port, options.host, undefined, () => res());
      }),
      mGetSettings(),
    ]);
    EvUiLaunched.next({ web: true });
    updateServerState({ server });
    const close = server.close.bind(server);
    server.close = () => {
      const { serverState } = cEvFinderState.value;
      if (serverState[currentAddress]?.server === server)
        delete serverState[currentAddress];
      if (cliServer) cEvFinderState.next({ serverState: { ...serverState } });
      return close();
    };
    return server;
  } finally {
    if (cEvFinderState.value.serverState[currentAddress].connecting)
      delete cEvFinderState.value.serverState[currentAddress];
  }
};

export const watchServerSettings = () => {
  EvUiCmdResult.subscribe(async (msg) => {
    if (
      msg.cmd === "listConfig" &&
      !msg.result.error &&
      (msg.result.oriData.type === ConfigLineType.serverSetting ||
        isEmpty(msg.result.oriData)) &&
      getDbInfoId(msg.context) === getDbInfoId(Config)
    ) {
      if (!msg.result.error) {
        const config = msg.result.results.filter(
          (v) => v.type === ConfigLineType.serverSetting
        )[0];
        if (!config || !config.jsonStr) return;
        try {
          const setting = JsonMore.parse(config.jsonStr) as TypeServerSetting;
          const { serverState } = cEvFinderState.value;
          if (!setting.serverOpen) {
            Object.values(serverState).forEach((v) => v.server?.close());
            cEvFinderState.next({});
          } else {
            const addressSet = new Set(setting.bindAddressList);
            Object.entries(serverState).forEach(([url, state]) => {
              if (!addressSet.has(url)) {
                state.server?.close();
                delete serverState[url];
              }
            });
            await Promise.all(
              setting.bindAddressList.map(async (v) => {
                if (serverState[v]?.server) return;
                try {
                  await createHttpServer(v, false);
                } catch (e) {
                  console.error(`Failed to launch server(${v})`, e);
                  serverState[v] = { error: String(e) };
                }
              })
            );
            cEvFinderState.next({ ...cEvFinderState.value });
          }
        } catch (e) {
          console.error("Process watchServerSettings msg failed", e);
        }
      }
    }
  });
};
