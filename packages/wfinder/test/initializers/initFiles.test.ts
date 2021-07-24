import {
  initFreshTestFiles,
  initOutsideTestFiles,
  initReadonlyTestFiles,
  initSimpleTestFiles,
} from ".";

describe("Init test files", () => {
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
