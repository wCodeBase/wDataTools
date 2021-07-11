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
import { useEventReady } from "../../hooks/webHooks";

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
        const res = await executeUiCmd("deletePath", {
          cmd: "deletePath",
          data: [v.path],
        }).catch((e) => {
          message.error(String(e));
          return null;
        });
        if (res) await state.listPath();
      },
      addNew: async (v: TypeMsgPathItem) => {
        const res = await executeUiCmd("addPath", {
          cmd: "addPath",
          data: [v.path],
        }).catch((e) => {
          message.error(String(e));
          return null;
        });
        if (res) await state.listPath();
        return !!res;
      },
      listPath: async () => {
        const res = await executeUiCmd("listPath", {
          cmd: "listPath",
          data: [],
        }).catch((e) => {
          message.error(String(e));
          return null;
        });
        if (res)
          setState({
            paths: res.result.results,
          });
        return !!res;
      },
    }));

    useEventReady(() => {
      state.listPath();
    });

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
