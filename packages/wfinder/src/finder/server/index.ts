import { createHttpServer } from "./httpServer";
import { initFinder } from "./../index";
import { HttpServerOption } from "../types";

export async function runAsServer(options: HttpServerOption) {
  await initFinder();
  const server = await createHttpServer(options);
  return server;
}
