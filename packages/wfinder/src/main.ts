#!/usr/bin/env node

import { Command } from "commander";
import { localhost } from "./constants";
import {
  addScanPath,
  deleteScanPath,
  findFiles,
  listScanPath,
} from "./finder/manager";
import { doScanCmd } from "./finder/scan";
import { HttpServerOption } from "./finder/types";

const program = new Command();
const defaultServerPort = 9000;
const defaultServerHost = localhost;
program
  .command("serve")
  .description("Start web server.")
  .option(
    "-p, --port <number>",
    `Port to listen to. default ${defaultServerPort}`
  )
  .option(
    "-a, --address <address>",
    `Host address to bind. default ${defaultServerHost}`
  )
  .action(async (options) => {
    let port = options.port ? Number.parseInt(options.port) : defaultServerPort;
    const host = options.host || defaultServerHost;
    let portConflict = false;
    while (true) {
      try {
        await require("./finder/server").runAsServer({
          port,
          host,
        } as HttpServerOption);
        console.log(`Server listening on http://${host}:${port}`);
        break;
      } catch (e) {
        if (e.code === "EADDRINUSE" && !options.port) {
          if (!portConflict) {
            console.log("Default port is in use, try another port...");
            portConflict = true;
          }
          port++;
        } else {
          console.error(`Faile to start server`, e);
          break;
        }
      }
    }
  });
program
  .name("wfinder")
  .version(require("../package.json").version)
  .option("-ap, --addPath <path>", "Add a path to scanPath list")
  .option("-lp, --listPath", "Show scanPath list")
  .option("-dp, --deletePath <path>", "Delete a scanPath")
  .option("-s, --scan", "Scan each scan path")
  .option("-f, --find <keyWords...>", "Find files by match filename")
  .option("-g, --gui", "Start GUI")
  .action(async (options) => {
    if (options.addPath) {
      await addScanPath(options.addPath);
    } else if (options.listPath) {
      await listScanPath();
    } else if (options.deletePath) {
      await deleteScanPath(options.deletePath);
    } else if (options.scan) {
      await doScanCmd();
    } else if (options.find) {
      await findFiles(options.find);
    } else if (options.gui) {
      require("./ui/electron").startElectron();
    } else {
      require("./finder/index").finder();
    }
  })
  .parse();
