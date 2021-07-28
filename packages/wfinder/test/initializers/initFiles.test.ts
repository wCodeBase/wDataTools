import {
  initFreshTestFiles,
  initOutsideTestFiles,
  initReadonlyTestFiles,
  initSimpleTestFiles,
} from ".";
import { shellJs } from "../imports";

describe("Init test files", function () {
  this.timeout(10000);
  it(`Rebuild dependencies`, () => {
    shellJs.exec(`npm run node-rebuild`);
  });
  it("Create simple test files", async () => {
    await initSimpleTestFiles();
  });
  it("Create fresh test files", async () => {
    await initFreshTestFiles();
  });
  it("Create outside test files", async () => {
    await initOutsideTestFiles();
  });
  it("Create readonly test files", async () => {
    await initReadonlyTestFiles();
  });
});
