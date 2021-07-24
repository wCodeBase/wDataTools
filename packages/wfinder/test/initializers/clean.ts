import path from "path";
import { testFileRoot, testRoots } from ".";
import { fse, shellJs } from "../imports";

const readonlyPaths = [path.join(testFileRoot, testRoots.readOnlyTestFolder)];
readonlyPaths.forEach((p) => {
  if (fse.existsSync(p)) shellJs.chmod("+w", p);
});
shellJs.exec(`rm -rf ${testFileRoot}`);
