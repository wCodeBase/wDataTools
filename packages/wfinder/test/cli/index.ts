import { randomPick } from "./../testTools";
import {
  testRoots,
  testFileRoot,
  simpleTestFileRange,
} from "./../initializers/index";
import "mocha";
import path from "path";
import { fse, shellJs } from "../imports";
import { expect } from "chai";
import { last } from "lodash";

const runWfinder = (params: string) => {
  const res = shellJs.exec(
    `echo y | node ${path.join(__dirname, "../../dist/main.js")} ${params}`
  );
  if (res.stderr) {
    res.stderr = res.stderr.replace(/Debugger attached.*\n/, "");
    res.stderr = res.stderr.replace(
      /Waiting for the debugger to disconnect.*\n/,
      ""
    );
  }
  if (res.stderr)
    throw new Error(`Run finder with params(${params}) failed: ${res.stderr}`);
  else return res.stdout;
};

describe("Cli test", function () {
  this.timeout(100000);

  (
    ["simpleTestFolder", "freshTestFolder"] as (keyof typeof testRoots)[]
  ).forEach((folderKey) => {
    const folder = testRoots[folderKey];
    it(`Cli test ${folderKey}`, async () => {
      const finderRoot = path.join(testFileRoot, folder);
      shellJs.cd(finderRoot);
      let res = "";
      [
        "./",
        "../" + testRoots.readOnlyTestFolder,
        "../" + testRoots.outsideTestFolder,
      ].forEach((scanPath) => {
        res = runWfinder(`-ap ${scanPath}`);
        expect(
          res.includes("ScanPath saved") || res.includes("Path already exist"),
          `${folder} scan path ${scanPath} saved`
        ).true;
      });
      runWfinder("-s");
      const specials = ["readonly", "outside"];
      ["file", "txt", "sub file", "sub in file"]
        .map((v) => v + " txt")
        .forEach((keyword) => {
          const resList = [""].concat(specials).map((word) => {
            const keywords = `${keyword} ${word}`;
            const v = runWfinder(`-f ${keywords}`);
            const lines = v.split("\n").filter((v) => v && v !== "...");
            if (last(lines) === "...") lines.splice(-1);
            const resultLine = lines[0];
            expect(
              resultLine.includes("Search results"),
              `${folder} keyword(${keywords}) search result normal`
            ).true;
            const total = Number.parseInt(resultLine.match(/\d+/)?.[0] || "");
            expect(total, `${folder} total result count`).to.greaterThan(0);
            lines.slice(1).forEach((p) => {
              const onePath = p.replace(/^[^)]*[)]: /, "");
              expect(
                fse.existsSync(path.resolve(onePath)),
                `${folder} search(${keywords}) result(${onePath}) exist`
              ).true;
            });
            return total;
          });
          const singleCont = resList[1];
          expect(
            resList.slice(1).every((v) => v === singleCont),
            `${folder} search result count the same`
          ).true;
          expect(
            resList[0] === singleCont * resList.length,
            `${folder} total search count equal single search`
          ).true;
        });
    });
  });
});
