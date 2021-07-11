import { createHttpServer } from "./httpServer";
import { initFinder } from "./../index";
import { HttpServerOption } from "../types";

export async function runAsServer(options: HttpServerOption) {
  const server = await createHttpServer(options);
  try {
    await initFinder();
  } catch (e) {
    server.close();
    throw e;
  }
  return server;
}
