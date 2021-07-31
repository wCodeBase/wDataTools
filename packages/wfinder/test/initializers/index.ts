import { last, range } from "lodash";
import path from "path";
import { Config } from "../../src/finder/common";
import { fse, shellJs } from "../imports";
import { initDb } from "./../../src/finder/db";

export const testFileRoot = path.resolve(__dirname, "../testFileFolder");

export const testRoots = {
  simpleTestFolder: "simpleTest",
  freshTestFolder: "freshTestDir",
  outsideTestFolder: "outsideTestDir",
  readOnlyTestFolder: "readOnlyTestDir",
};

export const simpleTestFileRange = range(1, 112);

export const initSimpleTestFiles = async (
  rootDir = testRoots.simpleTestFolder,
  filePrefix = ""
) => {
  if (filePrefix && last(filePrefix) !== "-") filePrefix = filePrefix + "-";
  let current = path.join(testFileRoot, rootDir);
  let filePath = path.join(current, `${filePrefix}testFile.txt`);
  const ensure = () => {
    fse.ensureDirSync(current);
    fse.ensureFileSync(filePath);
  };
  ensure();
  current = path.join(current, "testDir");
  ensure();
  simpleTestFileRange.forEach((num) => {
    filePath = path.join(current, `${filePrefix}fileInTestDir${num}.txt`);
    ensure();
  });
  current = path.join(path.parse(current).dir, "testSubDir");
  ensure();
  await initDb({
    finderRoot: current,
    dbPath: path.join(current, Config.dbName),
    dbName: Config.dbName,
  });
  simpleTestFileRange.forEach((num) => {
    filePath = path.join(current, `${filePrefix}fileInSubDir${num}.txt`);
    ensure();
  });
  current = path.join(current, "SubDir");
  simpleTestFileRange.forEach((num) => {
    filePath = path.join(current, `${filePrefix}subFile-${num}.abc`);
    ensure();
  });
};

export const initFreshTestFiles = async () => {
  fse.removeSync(path.join(testFileRoot, testRoots.freshTestFolder));
  await initSimpleTestFiles(testRoots.freshTestFolder);
};

export const initOutsideTestFiles = async () => {
  fse.removeSync(path.join(testFileRoot, testRoots.outsideTestFolder));
  await initSimpleTestFiles(testRoots.outsideTestFolder, "outside");
};

export const initReadonlyTestFiles = async () => {
  fse.ensureDirSync(path.join(testFileRoot, testRoots.readOnlyTestFolder));
  shellJs.chmod("+w", path.join(testFileRoot, testRoots.readOnlyTestFolder));
  await initSimpleTestFiles(testRoots.readOnlyTestFolder, "readonly");
  shellJs.chmod("-w", path.join(testFileRoot, testRoots.readOnlyTestFolder));
};
