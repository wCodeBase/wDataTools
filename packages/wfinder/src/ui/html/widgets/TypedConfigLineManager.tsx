import { ExportOutlined, ImportOutlined } from "@ant-design/icons";
import { Button, Input, message, Popconfirm, Tooltip } from "antd";
import { isEmpty, isEqual } from "lodash";
import React from "react";
import { EvUiCmdResult } from "../../../finder/events/events";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { TypeMsgConfigItem } from "../../../finder/events/types";
import { getLocalContext } from "../../../finder/events/webEvent";
import { ConfigLineType, getDbInfoId } from "../../../finder/types";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { useFinderReady } from "../../hooks/webHooks";
import { simpleGetKey } from "../../tools";
import {
  genManagerTable,
  SimpleBooleanEdit,
  SimpleTextEdit,
  TypeManagerTableAddonButtonProps,
  TypeManagerTableAddonOperationProps,
} from "../components/ManagerTable";
import { messageError, showModal } from "../uiTools";
import { defaultPropsFc } from "./../../tools/fc";

const isBusy = (props: TypeManagerTableAddonButtonProps<TypeMsgConfigItem>) => {
  return props.isReadonly || props.isTableEdit || props.isTableOnNew;
};

const genApplyToSubDatabaseButton = (mode: "add" | "delete") => {
  const title =
    mode === "add"
      ? "Add Config to all sub databases? "
      : "Are you sure to remove config line from here and all sub databases? ";
  const text = mode === "add" ? "Apply" : "abolish";
  return (props: TypeManagerTableAddonButtonProps<TypeMsgConfigItem>) => {
    if (isBusy(props) || !props.records.length) return null;
    const [state, setState] = useStableState(() => ({
      loading: false,
      onClick: async () => {
        const item = props.records[0];
        if (!item) return;
        setState({ loading: true });
        const res = await messageError(
          executeUiCmd("applyConfigsToSunDatabases", {
            cmd: "applyConfigsToSunDatabases",
            data: { ids: props.records.map((v) => v.id), mode },
            context: item.dbInfo || getLocalContext(),
          })
        );
        if (res) message.success("Modify config success");
        setState({ loading: false });
      },
    }));
    return (
      <Popconfirm
        title={title}
        disabled={state.loading}
        onConfirm={state.onClick}
      >
        <span className="m-0.5">
          <Button
            size="small"
            type="primary"
            danger={mode === "delete"}
            loading={state.loading}
          >
            <div className="flex flex-row items-center">{text}</div>
          </Button>
        </span>
      </Popconfirm>
    );
  };
};
const ApplyToSubDatabaseButton = genApplyToSubDatabaseButton("add");
const DeleteFromSubDatabaseButton = genApplyToSubDatabaseButton("delete");

const AddonButtons = (
  props: TypeManagerTableAddonButtonProps<TypeMsgConfigItem>
) => (
  <>
    <ApplyToSubDatabaseButton {...props} />
    <DeleteFromSubDatabaseButton {...props} />
  </>
);
const AddonOperationButtons = (
  props: TypeManagerTableAddonOperationProps<TypeMsgConfigItem>
) => (
  <>
    <ApplyToSubDatabaseButton {...props} records={[props.record]} />
    <DeleteFromSubDatabaseButton {...props} records={[props.record]} />
  </>
);

const genTypedConfigmanager = (
  type: ConfigLineType,
  tableTitle: string | JSX.Element,
  moreColumns: (keyof TypeMsgConfigItem)[] = [],
  canApplyToSubDatabases = false,
  contentLineImportable = false
) => {
  const ImportExport = React.memo(
    (props: TypeManagerTableAddonButtonProps<TypeMsgConfigItem>) => {
      if (isBusy(props)) return null;
      const showImportModal = (isImport = true) => {
        const handle = showModal(() => ({
          centered: true,
          title: (
            <div className="flex flex-row items-center">
              {isImport ? <ImportOutlined /> : <ExportOutlined />}{" "}
              <span className="ml-2">{tableTitle}</span>
            </div>
          ),
          footer: false,
          render: () => {
            const Fc = () => {
              const [state, setState] = useStableState(() => ({
                input: "",
                loading: false,
              }));
              return (
                <div>
                  <div className="text-sm opacity-70">
                    {isImport
                      ? "Add configs you want to import to input area, seperate by enter."
                      : "Export output is ready in input area bellow."}
                  </div>
                  <Input.TextArea
                    autoSize={{ minRows: 5, maxRows: 10 }}
                    value={
                      isImport
                        ? undefined
                        : props.records.map((v) => v.content).join("\n")
                    }
                    onChange={(ev) => setState({ input: ev.target.value })}
                    readOnly={!isImport}
                  />
                  {isImport && (
                    <div className="flex flex-row justify-end mt-2">
                      <Button
                        type="primary"
                        disabled={!state.input}
                        loading={state.loading}
                        onClick={async () => {
                          setState({ loading: true });
                          const res = await messageError(
                            executeUiCmd("addConfig", {
                              cmd: "addConfig",
                              data: state.input
                                .split("\n")
                                .filter((v) => v)
                                .map((v) => ({ type, content: v })),
                              context: props.context,
                            })
                          );
                          if (res) message.success("Import success.");
                          setState({ loading: false });
                          handle.destory();
                        }}
                      >
                        Import
                      </Button>
                    </div>
                  )}
                </div>
              );
            };
            return <Fc />;
          },
        }));
      };
      return (
        <>
          <span className="flex mx-0.5">
            <Tooltip title="Import configs">
              <Button
                icon={
                  <div className="flex flex-row items-center justify-center">
                    <ImportOutlined />
                  </div>
                }
                type="primary"
                size="small"
                onClick={() => showImportModal(true)}
              />
            </Tooltip>
          </span>
          {!!props.records.length && (
            <span className="flex mx-0.5">
              <Tooltip title="Export configs">
                <Button
                  icon={
                    <div className="flex flex-row items-center justify-center">
                      <ExportOutlined />
                    </div>
                  }
                  type="primary"
                  size="small"
                  onClick={() => showImportModal(false)}
                />
              </Tooltip>
            </span>
          )}
        </>
      );
    }
  );

  const TypedConfigTable = genManagerTable<TypeMsgConfigItem>(
    ["content", "updatedAt", ...moreColumns],
    {},
    { content: SimpleTextEdit, disabled: SimpleBooleanEdit },
    { content: SimpleTextEdit, disabled: SimpleBooleanEdit },
    simpleGetKey,
    () => ({
      id: -1,
      content: "",
      updatedAt: new Date(),
      createdAt: new Date(),
      dbInfo: undefined,
      type,
    }),
    canApplyToSubDatabases || contentLineImportable
      ? (props) => (
          <>
            {canApplyToSubDatabases && <AddonButtons {...props} />}
            {contentLineImportable && <ImportExport {...props} />}
          </>
        )
      : undefined,
    canApplyToSubDatabases ? AddonOperationButtons : undefined
  );
  const listConfigData = { type };
  return defaultPropsFc(
    { className: "", titleClassName: "", contexted: true },
    (props) => {
      const [state, setState] = useStableState(() => {
        const res = {
          waitingForCmdResult: false,
          configs: [] as TypeMsgConfigItem[],
          remove: async (v: TypeMsgConfigItem) => {
            await messageError(
              executeUiCmd("deleteConfig", {
                cmd: "deleteConfig",
                data: v,
              })
            );
          },
          addNew: async (v: TypeMsgConfigItem) => {
            const res = await messageError(
              executeUiCmd("addConfig", {
                cmd: "addConfig",
                data: [v],
                context: props.contexted ? getLocalContext() : undefined,
              })
            );
            return !!res;
          },
          save: async (v: TypeMsgConfigItem) => {
            const res = await messageError(
              executeUiCmd("saveConfig", {
                cmd: "saveConfig",
                data: v,
                context: props.contexted ? getLocalContext() : undefined,
              })
            );
            return !!res;
          },
          listConfig: async () => {
            await messageError(
              executeUiCmd("listConfig", {
                cmd: "listConfig",
                data: listConfigData,
                context: props.contexted ? getLocalContext() : undefined,
              })
            );
          },
        };
        return res;
      });

      useFinderReady(() => {
        state.listConfig();
      });

      useSubjectCallback(EvUiCmdResult, (res) => {
        if (
          res.cmd === "listConfig" &&
          !res.result.error &&
          (isEqual(listConfigData, res.result.oriData) ||
            isEmpty(res.result.oriData)) &&
          getDbInfoId(res.context) === getDbInfoId(getLocalContext())
        ) {
          setState({
            configs: res.result.results.filter((v) => v.type === type),
          });
        }
      });

      return (
        <div className={"flex flex-col overflow-auto " + props.className}>
          <TypedConfigTable
            records={state.configs}
            onRemove={state.remove}
            onNewRecord={state.addNew}
            onSave={state.save}
            tableTitle={tableTitle}
            titleClassName={props.titleClassName}
            context={props.contexted ? getLocalContext() : undefined}
          />
        </div>
      );
    },
    true
  );
};

export const FileNameToExcludeManager = genTypedConfigmanager(
  ConfigLineType.excludeFileName,
  "File names to exclude",
  undefined,
  true,
  true
);
export const FileNameToExcludeChildrenManager = genTypedConfigmanager(
  ConfigLineType.excludeChildrenFolderName,
  "File names to exclude children",
  undefined,
  true,
  true
);
export const AbsolutePathToExcludeManager = genTypedConfigmanager(
  ConfigLineType.excludeAbsPath,
  "Absolute paths to exclude",
  undefined,
  true,
  true
);
export const RemoteWfinderManager = genTypedConfigmanager(
  ConfigLineType.remoteUrl,
  "Remote wfinder to connect to",
  ["disabled"]
);
