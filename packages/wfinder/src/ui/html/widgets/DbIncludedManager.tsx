import {
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import path from "path";
import React, { useMemo } from "react";
import { EvFinderStatus, EvUiCmdResult } from "../../../finder/events/events";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { TypeDbIncludedItem } from "../../../finder/events/types";
import { getLocalContext } from "../../../finder/events/webEvent";
import { getDbInfoId, TypeDbInfo } from "../../../finder/types";
import {
  usePickBehaviorSubjectValue,
  useStableState,
  useSubjectCallback,
} from "wjstools";
import { useFinderReady } from "../../hooks/webHooks";
import { genManagerTable } from "../components/ManagerTable";
import { messageError } from "../uiTools";
import { defaultPropsFc } from "./../../tools/fc";

const DbIncludedTable = genManagerTable<TypeDbIncludedItem>(
  ["path"],
  { path: (v, record) => path.join(v, record.dbName) },
  {},
  {},
  (v) => v.path + v.dbInfo.dbPath,
  () => ({
    path: "",
    dbName: "",
    dbInfo: { finderRoot: "", dbPath: "", dbName: "" },
  }),
  undefined,
  undefined
);

export const DbIncludedManager = defaultPropsFc(
  {
    className: "",
    titleClassName: "",
    context: undefined as TypeDbInfo | undefined,
  },
  (props) => {
    const [state, setState] = useStableState(() => ({
      dbIncludeds: [] as TypeDbIncludedItem[],
      context: props.context || getLocalContext(),
      remove: async (v: TypeDbIncludedItem) => {
        const res = await messageError(
          executeUiCmd("deleteDbIncluded", {
            cmd: "deleteDbIncluded",
            data: [v.path],
            context: v.dbInfo,
          })
        );
        if (res) await state.listDbs();
      },
      listDbs: async () => {
        const res = await messageError(
          executeUiCmd("listDbIncluded", {
            cmd: "listDbIncluded",
            context: state.context,
          })
        );
        return !!res;
      },
    }));

    useFinderReady(() => {
      if (!props.context) state.context = getLocalContext();
      state.listDbs();
    });

    useSubjectCallback(
      EvUiCmdResult,
      (res) => {
        if (
          res.cmd === "listDbIncluded" &&
          !res.result.error &&
          getDbInfoId(res.context) === getDbInfoId(state.context)
        ) {
          setState({
            dbIncludeds: res.result.data,
          });
        }
      },
      []
    );

    const [scanning] = usePickBehaviorSubjectValue(
      EvFinderStatus,
      (v) => !!v.scanContextIdAndPathSet.size
    );

    const tableTitle = useMemo(() => {
      return (
        <div className="flex flex-row items-center">
          <span>Sub databases</span>
          <Tooltip title="Sub database is descovered in scanning and will be used to store data and search for results.">
            <span className="p-1 flex flex-row cursor-pointer">
              <QuestionCircleOutlined />
            </span>
          </Tooltip>
          {scanning && !!state.dbIncludeds.length && (
            <Tooltip title="Sub database is not editable when scanning.">
              <span className="p-1 text-red-500 flex flex-row cursor-pointer">
                <ExclamationCircleOutlined />
              </span>
            </Tooltip>
          )}
        </div>
      );
    }, [scanning]);

    return (
      <div className={"flex flex-col overflow-auto " + props.className}>
        <DbIncludedTable
          records={state.dbIncludeds}
          onRemove={state.remove}
          tableTitle={tableTitle}
          titleClassName={props.titleClassName}
          context={state.context}
          readOnly={scanning}
        />
      </div>
    );
  },
  true
);
