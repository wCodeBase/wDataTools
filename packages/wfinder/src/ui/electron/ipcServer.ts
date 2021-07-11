import { packetTool } from "./../../tools/streamTool";
import { switchEvent } from "./../../finder/events/eventGateway";
import net from "net";
import { isDev } from "./common";
import { localhost } from "../../constants";
import { TypeGateway } from "../../finder/events/eventTools";

export const USE_IPC_SERVER = "useIpcServer";

export const startIpcServer = async (connectionLimit = 1) => {
  const token = Date.now().toString(36) + Math.random().toString(36);
  let connectCount = 0;
  const server = new net.Server((socket) => {
    let verified = false;
    let gateway: TypeGateway | undefined;
    const dataCache: Buffer[] = [];
    socket.on("data", (data) => {
      try {
        if (!verified) {
          if (connectCount >= connectionLimit) return;
          if (String(data) === token) {
            verified = true;
            connectCount++;
            clearTimeout(timeout);
            socket.setNoDelay(true);
            gateway = switchEvent(
              (data) => socket.write(packetTool.wrapData(data)),
              true
            );
          }
        } else {
          if (!gateway) dataCache.push(data);
          else {
            let cached = dataCache.shift();
            while (cached) {
              packetTool
                .parseData(cached)
                .forEach((data) => gateway?.receive(String(data)));
              cached = dataCache.shift();
            }
            packetTool
              .parseData(data)
              .forEach((data) => gateway?.receive(String(data)));
          }
        }
      } catch (e) {
        console.log(
          `Failed to parse ipcServer data from client: ${socket.address()}`,
          e
        );
      }
    });
    const timeout = setTimeout(() => socket.destroy(), isDev ? 60000 : 6000);
    socket.on("close", () => {
      gateway?.unsubscribe();
      if (verified) connectCount--;
    });
  });
  await new Promise<void>((res) => server.listen(0, localhost, undefined, res));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Failed to create tcp server");
  return {
    token,
    server,
    address,
  };
};
