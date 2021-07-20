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
  SimplePathEdit,
  SimpleTextEdit,
  TypeManagerTableAddonButtonProps,
} from "../components/ManagerTable";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { useFinderReady } from "../../hooks/webHooks";
import { getLocalContext } from "../../../finder/events/webEvent";
import { useState } from "react";

const SearchButton = React.memo((props: TypeManagerTableAddonButtonProps) => {
  const [finderStatus] = useFinderStatus();
  return (
    <div className="flex flex-row">
      <div className="pl-2">
        <Button
          onClick={() => {
            EvUiCmd.next({
              cmd: "scan",
              data: null,
              context: getLocalContext(),
            });
          }}
          loading={finderStatus === FinderStatus.scanning}
          type="primary"
          size="small"
        >
          Scan
        </Button>
      </div>
      <ClearIndexButton />
    </div>
  );
});

const ClearIndexButton = React.memo(() => {
  const [lodaing, setLodaing] = useState(false);
  return (
    <div className="pl-2">
      <Button
        onClick={async () => {
          setLodaing(true);
          const res = await executeUiCmd("clearIndexedData", {
            cmd: "clearIndexedData",
            data: null,
            context: getLocalContext(),
          }).catch((e) => {
            message.error(String(e));
            return null;
          });
          if (res) {
            message.success("Clear scan data success");
          }
          setLodaing(false);
        }}
        loading={lodaing}
        type="primary"
        danger
        size="small"
      >
        Clear Data
      </Button>
    </div>
  );
});

const PathTable = genManagerTable<TypeMsgPathItem>(
  // FIXME: TODO: support dbInfo.
  ["path", { prop: "dbPath", title: "isolated db file" }, "createdAt"],
  { path: SimplePathEdit },
  { path: SimplePathEdit },
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
  { className: "", titleClassName: "", contexted: true },
  (props) => {
    const [state, setState] = useStableState(() => ({
      paths: [] as TypeMsgPathItem[],
      remove: async (v: TypeMsgPathItem) => {
        const res = await executeUiCmd("deletePath", {
          cmd: "deletePath",
          data: [v.path],
          context: v.dbInfo,
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
          context: props.contexted ? getLocalContext() : undefined,
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
          context: props.contexted ? getLocalContext() : undefined,
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
