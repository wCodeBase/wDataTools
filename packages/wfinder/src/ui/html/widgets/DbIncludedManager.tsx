import { defaultPropsFc } from "./../../tools/fc";
import React, { useEffect } from "react";
import {
  EvUiCmdResult,
  EvUiCmd,
  EvDefaultDbInfo,
  useFinderStatus,
  EvFinderStatus,
} from "../../../finder/events/events";
import {
  usePickBehaviorSubjectValue,
  useStableState,
  useSubjectCallback,
} from "../../hooks/hooks";
import {
  FinderStatus,
  TypeDbIncludedItem,
  TypeMsgPathItem,
} from "../../../finder/events/types";
import { Button, message, Popconfirm, Tooltip } from "antd";
import {
  genManagerTable,
  SimplePathEdit,
  SimpleTextEdit,
  TypeManagerTableAddonButtonProps,
  TypeManagerTableAddonOperationProps,
} from "../components/ManagerTable";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { useFinderReady } from "../../hooks/webHooks";
import { getLocalContext } from "../../../finder/events/webEvent";
import { useState } from "react";
import { getDbInfoId, TypeDbInfo } from "../../../finder/types";
import {
  ExclamationCircleFilled,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { formatDate } from "../../../tools/tool";
import { useMemo } from "react";
import { messageError } from "../uiTools";
import path from "path";

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
          <Tooltip title="Sub database is descovered when scanning and will be used to store data and search for results.">
            <span className="p-1 flex flex-row cursor-pointer">
              <QuestionCircleOutlined />
            </span>
          </Tooltip>
          {scanning && (
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
        />
      </div>
    );
  },
  true
);
