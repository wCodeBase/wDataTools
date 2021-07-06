import {
  exAddScanPath,
  exDeleteScanPath,
  exListScanPath,
} from "./../executors";

import { FileInfo } from "../entities/FileInfo";
import { doScan, stopScan } from "./../scan";
import { EvFinderState, EvLog, EvUiCmd, EvUiCmdResult } from "./events";
import { FinderState, TypeMsgPathItem } from "./types";

EvUiCmd.subscribe(async (msg) => {
  try {
    if (msg.cmd === "scan") {
      const { cmd } = msg;
      EvFinderState.next(FinderState.scanning);
      await doScan();
      EvUiCmdResult.next({ cmd, result: "done" });
      EvFinderState.next(FinderState.idle);
    } else if (msg.cmd === "stopScan") {
      stopScan();
    } else if (msg.cmd === "search") {
      const { cmd, data } = msg;
      EvFinderState.next(FinderState.searching);
      const total = await FileInfo.countByMatchName(data.keywords);
      const records = (
        await FileInfo.findByMatchName(data.keywords, data.take, data.skip)
      ).map((v) => {
        const { size, type, id, dbRoot } = v;
        return { name: v.getName(), size, type, id, dbRoot };
      });
      EvUiCmdResult.next({ cmd, result: { ...data, total, records } });
      EvFinderState.next(FinderState.idle);
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
      EvUiCmdResult.next({ cmd, result: { results, error } });
    } else if (msg.cmd === "listPath") {
      const { cmd } = msg;
      const { result } = await exListScanPath();
      EvUiCmdResult.next({
        cmd,
        result: { results: result.map((v) => v.toItem()), error: "" },
      });
    }
  } catch (e) {
    EvLog(
      `Error: failed to execute ui command. command: ${msg.cmd}, error: ${e}`
    );
  }
});
