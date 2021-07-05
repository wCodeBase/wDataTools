#!/usr/bin/env node

import { Command } from "commander";
import {
  addScanPath,
  deleteScanPath,
  findFiles,
  listScanPath,
} from "./finder/manager";
import { doScanCmd } from "./finder/scan";

const program = new Command();
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
