import { joinToAbsolute } from "../../tools/pathTool";
import { waitMilli } from "../../tools/tool";
import { isDev } from "../common";
import { getConfig, initDb, removeDbFiles, switchDb } from "../db";
import { FileInfo } from "../entities/FileInfo";
import { ScanPath } from "../entities/ScanPath";
import { Config } from "./../common";
import {
  exAddConfigLine,
  exAddScanPath,
  exApplyConfigLines,
  exClearIndexedData,
  exDeleteConfigLine,
  exDeleteDbIncluded,
  exDeleteScanPath,
  exListConfigLine,
  exListDbIncluded,
  exListScanPath,
  exSaveConfigLine,
} from "./../executors";
import { doScan, genExternalSubDbPath, stopScan } from "./../scan";
import { cEvRefreshRemote } from "./core/coreEvents";
import { EvFinderStatus, EvLogError, EvUiCmd, EvUiCmdResult } from "./events";
import { uiMsgTimeout } from "./eventTools";
import {
  FinderStatus,
  TypeMsgConfigItem,
  TypeMsgPathItem,
  TypeUiMsgData,
  TypeUiMsgResult,
} from "./types";

export const uiCmdExecutor = async function (msg: TypeUiMsgData | null) {
  if (!msg) return;
  let finished = false;
  const context = msg.context || Config;
  try {
    const triggerHeartBeat = async () => {
      const { tag } = msg;
      if (!tag) return;
      while (!finished) {
        await waitMilli(uiMsgTimeout / 4);
        EvUiCmdResult.next({ cmd: "MsgHeartbeat", tag });
      }
    };
    if (
      msg.cmd === "requestPickLocalPath" ||
      msg.cmd === "requestChooseFinderRoot" ||
      msg.cmd === "queryUserDataDir"
    )
      return;
    const cmdResult = await switchDb(context, async function () {
      let cmdResult: TypeUiMsgResult;
      if (msg.cmd === "scan") {
        const { cmd } = msg;
        EvFinderStatus.next({ status: FinderStatus.scanning });
        await doScan(msg.context, true, false, 0, msg.data.path);
        cmdResult = { cmd, result: "done" };
        EvFinderStatus.next({ status: FinderStatus.idle });
      } else if (msg.cmd === "stopScan") {
        stopScan(msg.data.path);
        const { cmd } = msg;
        cmdResult = { cmd, result: "done" };
      } else if (msg.cmd === "search") {
        triggerHeartBeat();
        const { cmd, data } = msg;
        EvFinderStatus.next({ status: FinderStatus.searching });
        try {
          const [total, records] = await Promise.all([
            await FileInfo.countByMatchName(
              data.keywords,
              data.fullMatchInput,
              data.regMatchInput
            ),
            (
              await FileInfo.findByMatchName(
                data.keywords,
                data.fullMatchInput,
                data.regMatchInput,
                data.take,
                data.skip
              )
            ).map((v) => {
              const { size, type, id, dbInfo, absPath } = v;
              return { name: v.getName(), size, type, id, dbInfo, absPath };
            }),
          ]);
          cmdResult = { cmd, result: { ...data, total, records } };
          EvFinderStatus.next({ status: FinderStatus.idle });
        } finally {
          EvFinderStatus.next({ status: FinderStatus.idle });
        }
      } else if (msg.cmd === "clearIndexedData") {
        triggerHeartBeat();
        const {
          cmd,
          data: { path },
        } = msg;
        await exClearIndexedData(msg.context, path);
        cmdResult = { cmd, result: "done" };
      } else if (msg.cmd === "addPath" || msg.cmd === "deletePath") {
        triggerHeartBeat();
        const { cmd, data } = msg;
        let error = "";
        const results: TypeMsgPathItem[] = [];
        const executor =
          msg.cmd === "addPath" ? exAddScanPath : exDeleteScanPath;
        for (const scanPath of data) {
          const res = await executor(scanPath);
          if (res.error === undefined) {
            results.push(res.result);
          } else {
            error = res.error;
            break;
          }
        }
        cmdResult = { cmd, result: { results, error } };
      } else if (msg.cmd === "listPath") {
        const { cmd } = msg;
        const { result } = await exListScanPath();
        cmdResult = {
          cmd,
          result: { results: result, error: "" },
        };
      } else if (msg.cmd === "splitSubDb" || msg.cmd === "removeSubDb") {
        const { cmd } = msg;
        const scanPath = await ScanPath.findOne(msg.data.scanPathId);
        if (!scanPath) throw new Error("ScanPath not exist.");
        if (msg.cmd === "splitSubDb") {
          let dbPath = (scanPath.dbPath = genExternalSubDbPath(scanPath));
          dbPath = joinToAbsolute(getConfig().finderRoot, dbPath);
          await initDb({
            dbPath,
            dbName: context.dbName,
            finderRoot: joinToAbsolute(context.finderRoot, scanPath.path),
            isSubDb: true,
          });
        } else {
          const dbPath = scanPath.dbPath;
          if (dbPath) {
            await removeDbFiles(joinToAbsolute(context.finderRoot, dbPath));
            scanPath.dbPath = "";
          }
        }
        scanPath.lastMessage = "Info changed, rescan required";
        await scanPath.save();
        cmdResult = { cmd, result: {} };
      } else if (msg.cmd === "addConfig") {
        const { cmd, data } = msg;
        const error = "";
        const { results } = await exAddConfigLine(data);
        cmdResult = { cmd, result: { results, error } };
      } else if (msg.cmd === "deleteConfig") {
        const { cmd, data } = msg;
        let error = "";
        const res = await exDeleteConfigLine(data);
        const results: TypeMsgConfigItem[] = [];
        if (res.error === undefined) {
          results.push(res.result.toItem());
        } else {
          error = res.error;
        }
        cmdResult = { cmd, result: { results, error } };
      } else if (msg.cmd === "listConfig") {
        const { cmd } = msg;
        const { result } = await exListConfigLine(msg.data);
        cmdResult = {
          cmd,
          result: {
            results: result.map((v) => v.toItem()),
            oriData: msg.data,
            error: "",
          },
        };
      } else if (msg.cmd === "saveConfig" || msg.cmd === "saveOrCreateConfig") {
        const { cmd } = msg;
        const res = await exSaveConfigLine(msg.data);
        let { result } = res;
        const error = res.error || "";
        if ((error || !result?.length) && msg.cmd === "saveOrCreateConfig") {
          const res = await exAddConfigLine([msg.data]);
          result = res.results;
        }
        cmdResult = {
          cmd,
          result: { results: result ? result : [], error },
        };
      } else if (msg.cmd === "applyConfigsToSunDatabases") {
        const { cmd } = msg;
        await exApplyConfigLines(msg.data.ids, msg.data.mode);
        cmdResult = {
          cmd,
          result: {},
        };
      } else if (msg.cmd === "listDbIncluded") {
        const { cmd } = msg;
        const res = await exListDbIncluded();
        cmdResult = {
          cmd,
          result: {
            data: res.result.map(({ path, dbInfo, dbName }) => ({
              path,
              dbInfo,
              dbName,
            })),
          },
        };
      } else if (msg.cmd === "deleteDbIncluded") {
        const { cmd } = msg;
        const res = await exDeleteDbIncluded(context, msg.data);
        cmdResult = {
          cmd,
          result: {
            data: res.result.map(({ path, dbInfo, dbName }) => ({
              path,
              dbInfo,
              dbName,
            })),
          },
        };
      } else if (msg.cmd === "countAllFileInfo") {
        const [total, localTotal, remoteTotal] =
          await FileInfo.countAllDatabases();
        cmdResult = {
          cmd: msg.cmd,
          result: {
            total,
            remoteTotal,
            localTotal,
          },
        };
      } else if (msg.cmd === "refreshRemote") {
        cEvRefreshRemote.next();
        cmdResult = { cmd: "refreshRemote", result: {} };
      } else {
        throw new Error(`Command will not be processed.`);
      }
      return cmdResult;
    });
    if (msg.tag) cmdResult.tag = msg.tag;
    cmdResult.context = context;
    EvUiCmdResult.next(cmdResult);
  } catch (e) {
    EvLogError(
      `Error: failed to execute ui command. command: ${msg.cmd}, error: ${e}`
    );
    EvUiCmdResult.next({
      cmd: msg.cmd,
      tag: msg.tag,
      context,
      result: { error: `Failed to execute command: ${msg.cmd}, error: ${e}` },
    } as TypeUiMsgResult);
    if (isDev) {
      console.log(`Failed to execute command: ${msg.cmd}`, e);
    }
  } finally {
    finished = true;
  }
};

EvUiCmd.subscribe(uiCmdExecutor);
