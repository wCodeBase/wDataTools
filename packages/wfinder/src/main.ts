import { finder } from "./finder/index";
import { blue } from "colors";
import { Command } from "commander";

const program = new Command();
program
  .name("wfinder")
  .version(require("../package.json").version)
  .action(() => {
    finder();
  })
  .parse();
