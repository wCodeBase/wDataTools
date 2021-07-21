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
import { Button, message, Tooltip } from "antd";
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
import { ExclamationCircleFilled } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatDate } from "../../../tools/tool";
import { useMemo } from "react";

const SearchButton = React.memo(
  (
    props: TypeManagerTableAddonButtonProps<TypeMsgPathItem> & {
      context?: TypeDbInfo;
      tiny?: boolean;
      noClear?: boolean;
    }
  ) => {
    const [finderStatus] = useFinderStatus();
    const context = props.context || getLocalContext();
    const contextPaths = useMemo(() => {
      return props.records.map((v) => getDbInfoId(v.dbInfo) + v.path);
    }, [context, context, props.records]);
    const scanning = useMemo(() => {
      return contextPaths.some((v) =>
        finderStatus.scanContextIdAndPathSet.has(v)
      );
    }, [finderStatus.scanContextIdAndPathSet, contextPaths]);
    return (
      <div className="flex flex-row">
        <div className="pl-2">
          <Button
            onClick={() => {
              EvUiCmd.next({
                cmd: "scan",
                data: {
                  path: props.records.map((v) => v.path),
                },
                context,
              });
            }}
            loading={scanning}
            type="primary"
            size="small"
          >
            Scan
          </Button>
        </div>
        {!props.noClear && <ClearIndexButton {...props} disabled={scanning} />}
      </div>
    );
  }
);

const ClearIndexButton = React.memo(
  (props: {
    context?: TypeDbInfo;
    tiny?: boolean;
    disabled?: boolean;
    records: TypeMsgPathItem[];
  }) => {
    const [lodaing, setLodaing] = useState(false);
    return (
      <div className="pl-2">
        <Button
          onClick={async () => {
            setLodaing(true);
            const res = await executeUiCmd("clearIndexedData", {
              cmd: "clearIndexedData",
              data: {
                path: props.records.map((v) => v.path),
              },
              context: props.context || getLocalContext(),
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
          disabled={props.disabled}
          type="primary"
          danger
          size="small"
        >
          Clear{!props.tiny && " Data"}
        </Button>
      </div>
    );
  }
);

const ScanAddonOperations = React.memo<
  TypeManagerTableAddonOperationProps<TypeMsgPathItem>
>((props) => {
  if (props.isTableEdit || props.isTableOnNew) return null;
  return (
    <div className="m-0.5">
      <SearchButton
        {...props}
        context={props.record.dbInfo}
        tiny
        records={[props.record]}
        noClear
      />
    </div>
  );
});

const PathTable = genManagerTable<TypeMsgPathItem>(
  // FIXME: TODO: support dbInfo.
  [
    "path",
    { prop: "dbPath", title: "isolated db file" },
    "createdAt",
    "lastScanedAt",
  ],
  {
    lastScanedAt: (val, record) => {
      const content = (
        <div
          className={
            "flex flex-row items-center truncate " +
            (record.lastScanError ? "text-red-400 cursor-pointer" : "")
          }
        >
          <span className="flex-shrink">{formatDate(val)}</span>
          {record.lastScanError && (
            <span className="flex items-center flex-shrink-0 ml-1">
              <ExclamationCircleFilled />
            </span>
          )}
        </div>
      );
      if (record.lastScanError)
        return (
          <Tooltip title={"Last scaned with error: \n" + record.lastScanError}>
            {content}
          </Tooltip>
        );
      else return content;
    },
  },
  { path: SimplePathEdit },
  { path: SimplePathEdit },
  simpleGetKey,
  () => ({
    id: -1,
    path: "",
    createdAt: new Date(),
    dbInfo: EvDefaultDbInfo.value,
  }),
  SearchButton,
  ScanAddonOperations
);

export const ScanPathManager = defaultPropsFc(
  {
    className: "",
    titleClassName: "",
    context: undefined as TypeDbInfo | undefined,
  },
  (props) => {
    const [state, setState] = useStableState(() => ({
      paths: [] as TypeMsgPathItem[],
      context: props.context || getLocalContext(),
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
          context: state.context,
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
          context: state.context,
        }).catch((e) => {
          message.error(String(e));
          return null;
        });
        return !!res;
      },
    }));

    useFinderReady(() => {
      state.listPath();
      if (!state.context) state.context = getLocalContext();
    });

    useSubjectCallback(
      EvUiCmdResult,
      (res) => {
        if (
          res.cmd === "listPath" &&
          !res.result.error &&
          getDbInfoId(res.context) === getDbInfoId(state.context)
        ) {
          setState({
            paths: res.result.results,
          });
        }
      },
      []
    );

    return (
      <div className={"flex flex-col overflow-auto " + props.className}>
        <PathTable
          records={state.paths}
          onRemove={state.remove}
          onNewRecord={state.addNew}
          tableTitle="Included paths"
          titleClassName={props.titleClassName}
        />
      </div>
    );
  },
  true
);
