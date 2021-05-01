import { blue } from "colors";
import { program } from "commander";
import { serve } from "rtc-data";

program
  .version(require("../package.json").version)
  .option("-h, --host <ip>", "set ip to bind", "0.0.0.0")
  .option("-p, --port <number>", "set port number to bind", "8000")
  .parse();

const opts = program.opts();
const host = opts.host || "0.0.0.0";
const port = Number(opts.port || "8000");
serve(port, host);
console.log(`Server listening on ` + blue(`http://${host}:${port}`));
