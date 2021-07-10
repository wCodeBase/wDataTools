import { defaultPropsFc } from "./../../tools/fc";
import React, { useEffect } from "react";
import {
  EvUiCmdResult,
  EvUiCmd,
  EvDefaultDbInfo,
} from "../../../finder/events/events";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { TypeMsgPathItem } from "../../../finder/events/types";
import { message } from "antd";
import { genManagerTable, SimpleTextEdit } from "../components/ManagerTable";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { Config } from "../../../finder/common";

const PathTable = genManagerTable<TypeMsgPathItem>(
  // FIXME: TODO: support dbInfo.
  ["path", "createdAt"],
  { path: SimpleTextEdit },
  { path: SimpleTextEdit },
  simpleGetKey,
  () => ({
    id: -1,
    path: "",
    createdAt: new Date(),
    dbInfo: EvDefaultDbInfo.value,
  })
);

export const ScanPathManager = defaultPropsFc(
  { className: "", titleClassName: "" },
  (props) => {
    const [state, setState] = useStableState(() => ({
      waitingForCmdResult: false,
      paths: [] as TypeMsgPathItem[],
      remove: async (v: TypeMsgPathItem) => {
        await executeUiCmd("deletePath", {
          cmd: "deletePath",
          data: [v.path],
        }).catch((e) => {
          message.error(e);
          return null;
        });
      },
      addNew: async (v: TypeMsgPathItem) => {
        const res = await executeUiCmd("addPath", {
          cmd: "addPath",
          data: [v.path],
        }).catch((e) => {
          message.error(e);
          return null;
        });
        return !!res;
      },
      checkBusy: () => {
        if (state.waitingForCmdResult)
          message.warn("Busy now, pleace waiting...");
        return state.waitingForCmdResult;
      },
    }));

    useSubjectCallback(EvUiCmdResult, (msg) => {
      if (msg.cmd === "deletePath" || msg.cmd === "addPath") {
        if (msg.result.error) {
          message.error(msg.result.error);
          setState({ waitingForCmdResult: false });
        } else {
          EvUiCmd.next({ cmd: "listPath", data: [] });
        }
      } else if (msg.cmd === "listPath") {
        setState({
          paths: msg.result.results,
        });
        if (msg.result.error) message.error(msg.result.error);
        if (state.waitingForCmdResult) setState({ waitingForCmdResult: false });
      }
    });

    useEffect(() => {
      EvUiCmd.next({ cmd: "listPath", data: [] });
    }, []);

    return (
      <div className={"flex flex-col overflow-auto " + props.className}>
        <PathTable
          records={state.paths}
          onRemove={state.remove}
          onNewRecord={state.addNew}
          tableTitle="included paths"
          titleClassName={props.titleClassName}
        />
      </div>
    );
  },
  true
);
