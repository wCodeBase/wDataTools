import { createHttpServer } from "./httpServer";
import { initFinder } from "./../index";
import { HttpServerOption, TypeServerSetting } from "../types";

export async function runAsServer(
  options: HttpServerOption,
  isolateSettings?: TypeServerSetting
) {
  await initFinder();
  const server = await createHttpServer(options, true, isolateSettings);
  return server;
}
