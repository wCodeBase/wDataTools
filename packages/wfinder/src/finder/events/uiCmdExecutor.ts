import {
  exAddConfigLine,
  exAddScanPath,
  exDeleteConfigLine,
  exDeleteScanPath,
  exListConfigLine,
  exListScanPath,
  exSaveConfigLine,
} from "./../executors";

import { FileInfo } from "../entities/FileInfo";
import { doScan, stopScan } from "./../scan";
import { EvFinderStatus, EvLog, EvUiCmd, EvUiCmdResult } from "./events";
import {
  FinderStatus,
  TypeMsgConfigItem,
  TypeMsgPathItem,
  TypeUiMsgResult,
} from "./types";
import { waitMilli } from "../../tools/tool";
import { uiMsgTimeout } from "./eventTools";

EvUiCmd.subscribe(async (msg) => {
  if (!msg) return;
  let finished = false;
  try {
    const triggerHeartBeat = async () => {
      const { tag } = msg;
      if (!tag) return;
      while (!finished) {
        await waitMilli(uiMsgTimeout / 4);
        EvUiCmdResult.next({ cmd: "MsgHeartbeat", tag });
      }
    };
    let cmdResult: TypeUiMsgResult;
    if (msg.cmd === "scan") {
      const { cmd } = msg;
      EvFinderStatus.next(FinderStatus.scanning);
      await doScan();
      cmdResult = { cmd, result: "done" };
      EvFinderStatus.next(FinderStatus.idle);
    } else if (msg.cmd === "stopScan") {
      stopScan();
      const { cmd } = msg;
      cmdResult = { cmd, result: "done" };
    } else if (msg.cmd === "search") {
      triggerHeartBeat();
      const { cmd, data } = msg;
      EvFinderStatus.next(FinderStatus.searching);
      const total = await FileInfo.countByMatchName(data.keywords);
      const records = (
        await FileInfo.findByMatchName(data.keywords, data.take, data.skip)
      ).map((v) => {
        const { size, type, id, dbInfo } = v;
        return { name: v.getName(), size, type, id, dbInfo };
      });
      cmdResult = { cmd, result: { ...data, total, records } };
      EvFinderStatus.next(FinderStatus.idle);
    } else if (msg.cmd === "addPath" || msg.cmd === "deletePath") {
      const { cmd, data } = msg;
      let error = "";
      const results: TypeMsgPathItem[] = [];
      const executor = msg.cmd === "addPath" ? exAddScanPath : exDeleteScanPath;
      for (const scanPath of data) {
        const res = await executor(scanPath);
        if (res.error === undefined) {
          results.push(res.result.toItem());
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
        result: { results: result.map((v) => v.toItem()), error: "" },
      };
    } else if (msg.cmd === "addConfig") {
      const { cmd, data } = msg;
      let error = "";
      const res = await exAddConfigLine(data, data.dbInfo);
      const results: TypeMsgConfigItem[] = [];
      if (res.error === undefined) {
        results.push(res.result.toItem());
      } else {
        error = res.error;
      }
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
      const { result } = await exListConfigLine(msg.data.type);
      cmdResult = {
        cmd,
        result: { results: result.map((v) => v.toItem()), error: "" },
      };
    } else if (msg.cmd === "saveConfig" || msg.cmd === "saveOrCreateConfig") {
      const { cmd } = msg;
      let { result, error = "" } = await exSaveConfigLine(msg.data);
      if (!error && !result?.length) {
        const res = await exSaveConfigLine(msg.data);
        result = res.result;
        error = res.error || "";
      }
      cmdResult = {
        cmd,
        result: { results: result ? result : [], error },
      };
    } else {
      throw new Error(`Command will not be processed.`);
    }
    cmdResult.tag = msg.tag;
    EvUiCmdResult.next(cmdResult);
  } catch (e) {
    EvLog(
      `Error: failed to execute ui command. command: ${msg.cmd}, error: ${e}`
    );
  } finally {
    finished = true;
  }
});
