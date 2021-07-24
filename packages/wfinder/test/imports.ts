import { isTestDebug } from "./testCommon";

export * as fse from "fs-extra";
export * as shellJs from "shelljs";
import * as shellJs from "shelljs";

shellJs.config.silent = !isTestDebug;
