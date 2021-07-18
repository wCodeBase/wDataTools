import { defaultPropsFc } from "./../../tools/fc";
import React, { useEffect } from "react";
import {
  EvUiCmdResult,
  EvUiCmd,
  EvDefaultDbInfo,
  useFinderStatus,
} from "../../../finder/events/events";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { FinderStatus, TypeMsgPathItem } from "../../../finder/events/types";
import { Button, message } from "antd";
import {
  genManagerTable,
  SimpleTextEdit,
  TypeManagerTableAddonButtonProps,
} from "../components/ManagerTable";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { useFinderReady } from "../../hooks/webHooks";

const SearchButton = React.memo((props: TypeManagerTableAddonButtonProps) => {
  const [finderStatus] = useFinderStatus();
  return (
    <div className="pl-2">
      <Button
        onClick={() => {
          EvUiCmd.next({ cmd: "scan", data: null });
        }}
        loading={finderStatus === FinderStatus.scanning}
        type="primary"
        size="small"
      >
        Scan
      </Button>
    </div>
  );
});

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
  }),
  SearchButton
);

export const ScanPathManager = defaultPropsFc(
  { className: "", titleClassName: "" },
  (props) => {
    const [state, setState] = useStableState(() => ({
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

    useFinderReady(() => {
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
