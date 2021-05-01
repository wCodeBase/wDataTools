import { blue } from "colors";
import { Command } from "commander";

const program = new Command();
program
  .name("wtransfer")
  .version(require("../package.json").version)
  .option("-h, --host <url>", "use a custom server")
  .option("-p, --port <number>", "set port number to bind", "8000");

const serve = program.command("serve [path]");
serve.description("serve a file or path").action((fPath) => {
  console.log("serve: ", fPath);
});

const fetch = program.command("fetch [hash]");
fetch
  .description("get a file or path")
  .option("-p, --password <password>", "use a password")
  .action((hash) => {
    console.log("fetch: ", hash);
  });

program.parse();
