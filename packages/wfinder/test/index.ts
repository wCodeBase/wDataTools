import { ensureJsFile } from "./testTools";
import path from "path";

(async () => {
  let tests = process.argv.slice(3);

  if (!tests.length)
    tests = [
      "./initializers/initFiles.test.ts",
      "./cli/index.ts",
      "./unit/index.ts",
    ];
  tests.forEach((ts) => {
    const sourceFile = ensureJsFile(path.join(__dirname, ts));
    require(sourceFile);
  });
})();
