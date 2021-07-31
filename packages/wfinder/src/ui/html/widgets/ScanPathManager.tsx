import { ExclamationCircleFilled } from "@ant-design/icons";
import { Button, message, Popconfirm, Tooltip } from "antd";
import prettyMs from "pretty-ms";
import React, { useMemo, useState } from "react";
import {
  EvDefaultDbInfo,
  EvUiCmd,
  EvUiCmdResult,
  useFinderStatus,
} from "../../../finder/events/events";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { TypeMsgPathItem } from "../../../finder/events/types";
import { getLocalContext } from "../../../finder/events/webEvent";
import { getDbInfoId, TypeDbInfo } from "../../../finder/types";
import { formatDate } from "../../../tools/tool";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { useFinderReady } from "../../hooks/webHooks";
import { simpleGetKey } from "../../tools";
import {
  genManagerTable,
  SimplePathEdit,
  TypeManagerTableAddonButtonProps,
  TypeManagerTableAddonOperationProps,
} from "../components/ManagerTable";
import { messageError } from "../uiTools";
import { defaultPropsFc } from "./../../tools/fc";

const usePathScanning = (records: TypeMsgPathItem[], context?: TypeDbInfo) => {
  const [finderStatus] = useFinderStatus();
  context = context || getLocalContext();
  const contextPaths = useMemo(() => {
    return records.map((v) => getDbInfoId(v.dbInfo) + v.path);
  }, [context, records]);
  return useMemo(() => {
    return contextPaths.some((v) =>
      finderStatus.scanContextIdAndPathSet.has(v)
    );
  }, [finderStatus.scanContextIdAndPathSet, contextPaths]);
};

const SearchButton = React.memo(
  (
    props: TypeManagerTableAddonButtonProps<TypeMsgPathItem> & {
      context?: TypeDbInfo;
      toLine?: boolean;
      noClear?: boolean;
    }
  ) => {
    const context = props.context || getLocalContext();
    const scanning = usePathScanning(props.records, context);
    return (
      <div className="flex flex-row">
        <div className="pl-1">
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
        {scanning && (
          <div className="pl-1">
            <Button
              type="primary"
              size="small"
              danger
              onClick={() => {
                EvUiCmd.next({
                  cmd: "stopScan",
                  data: {
                    path: props.records.map((v) => v.path),
                  },
                  context,
                });
              }}
            >
              Stop
            </Button>
          </div>
        )}
        {!props.noClear && <ClearIndexButton {...props} disabled={scanning} />}
      </div>
    );
  }
);

const ClearIndexButton = React.memo(
  (props: {
    context?: TypeDbInfo;
    toLine?: boolean;
    disabled?: boolean;
    records: TypeMsgPathItem[];
  }) => {
    const [lodaing, setLodaing] = useState(false);
    return (
      <div className="pl-1">
        <Popconfirm
          title="Are you sure to remove scanned data?"
          onConfirm={async () => {
            setLodaing(true);
            const res = await messageError(
              executeUiCmd("clearIndexedData", {
                cmd: "clearIndexedData",
                data: {
                  path: props.records.map((v) => v.path),
                },
                context: props.context || getLocalContext(),
              })
            );
            if (res) {
              message.success("Clear scan data success");
            }
            setLodaing(false);
          }}
        >
          <Button
            loading={lodaing}
            disabled={props.disabled}
            type="primary"
            danger
            size="small"
          >
            Clear{!props.toLine && " Data"}
          </Button>
        </Popconfirm>
      </div>
    );
  }
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
        const res = await messageError(
          executeUiCmd("deletePath", {
            cmd: "deletePath",
            data: [v.path],
            context: v.dbInfo,
          })
        );
        if (res) await state.listPath();
      },
      addNew: async (v: TypeMsgPathItem) => {
        const res = await messageError(
          executeUiCmd("addPath", {
            cmd: "addPath",
            data: [v.path],
            context: state.context,
          })
        );
        if (res) await state.listPath();
        return !!res;
      },
      listPath: async () => {
        const res = await messageError(
          executeUiCmd("listPath", {
            cmd: "listPath",
            data: [],
            context: state.context,
          })
        );
        return !!res;
      },
      subDbManage: async (
        scanPath: TypeMsgPathItem,
        cmd: "removeSubDb" | "splitSubDb"
      ) => {
        await messageError(
          executeUiCmd(cmd, {
            cmd,
            data: { scanPathId: scanPath.id },
            context: state.context,
          })
        );
      },
    }));

    const PathTable = useMemo(() => {
      const SubDbButtons = React.memo<
        TypeManagerTableAddonOperationProps<TypeMsgPathItem>
      >((props) => {
        const scanning = usePathScanning([props.record], props.record.dbInfo);
        return (
          <div className="m-0.5">
            {props.record.dbPath ? (
              <Popconfirm
                title="Are you sure to remove isolated sub databas of this scan path?"
                disabled={scanning}
                onConfirm={() => state.subDbManage(props.record, "removeSubDb")}
              >
                <Button type="primary" danger size="small">
                  RM DB
                </Button>
              </Popconfirm>
            ) : (
              <Button
                disabled={scanning}
                type="primary"
                size="small"
                onClick={() => state.subDbManage(props.record, "splitSubDb")}
              >
                New DB
              </Button>
            )}
          </div>
        );
      });

      const ScanAddonOperations = React.memo<
        TypeManagerTableAddonOperationProps<TypeMsgPathItem>
      >((props) => {
        if (props.isTableEdit || props.isTableOnNew) return null;
        return (
          <>
            <div className="m-0.5">
              <SearchButton
                {...props}
                context={props.record.dbInfo}
                toLine
                records={[props.record]}
                noClear={!props.record.dbPath}
              />
            </div>
            {!props.isTableEdit && !props.isTableOnNew && (
              <SubDbButtons {...props} />
            )}
          </>
        );
      });

      return genManagerTable<TypeMsgPathItem>(
        [
          "path",
          { prop: "dbPath", title: "isolated db file" },
          "createdAt",
          "lastScanedAt",
          { prop: "lastSuccessCost", title: "cost" },
        ],
        {
          lastScanedAt: (val, record) => {
            const content = (
              <div
                className={
                  "flex flex-row items-center truncate " +
                  (record.lastMessage ? "text-red-400 cursor-pointer" : "")
                }
              >
                <span className="flex-shrink">{formatDate(val)}</span>
                {record.lastMessage && (
                  <span className="flex items-center flex-shrink-0 ml-1">
                    <ExclamationCircleFilled />
                  </span>
                )}
              </div>
            );
            if (record.lastMessage)
              return (
                <Tooltip title={"Last message: \n" + record.lastMessage}>
                  {content}
                </Tooltip>
              );
            else return content;
          },
          lastSuccessCost: (v) => v && prettyMs(v),
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
    }, []);

    useFinderReady(() => {
      if (!props.context) state.context = getLocalContext();
      state.listPath();
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
          tableTitle="Scan paths"
          titleClassName={props.titleClassName}
          context={state.context}
        />
      </div>
    );
  },
  true
);
