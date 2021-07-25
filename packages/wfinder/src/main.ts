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
import {
  defaultServerSetting,
  HttpServerOption,
  TypeServerSetting,
} from "./finder/types";
import { parseAddress } from "./tools/tool";

const program = new Command();
const defaultServerAddress = defaultServerSetting.bindAddressList[0];
const { port: defaultServerPort, host: defaultServerHost } =
  parseAddress(defaultServerAddress);

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
  .option(
    "-i, --ip <ips...>",
    `Limit access only to ips which match any of given regular expressions`
  )
  .action(async (options) => {
    let port = options.port ? Number.parseInt(options.port) : defaultServerPort;
    const host = options.host || defaultServerHost;
    let portConflict = false;
    let settings: TypeServerSetting | undefined = undefined;
    if (options.ip) {
      settings = { ...defaultServerSetting, allowIps: options.ip };
    }
    while (true) {
      try {
        await require("./finder/server").runAsServer(
          {
            port,
            host,
          } as HttpServerOption,
          settings
        );
        console.log(`Server listening on http://${host}:${port}`);
        if (options.ip)
          console.warn(
            "Only request from these ips will be acceptted: " +
              options.ip.join(", ")
          );
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
