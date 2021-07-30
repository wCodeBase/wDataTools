import { defaultPropsFc } from "./../../tools/fc";
import React, { useEffect } from "react";
import {
  EvUiCmdResult,
  EvUiCmd,
  EvDefaultDbInfo,
} from "../../../finder/events/events";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { TypeMsgConfigItem } from "../../../finder/events/types";
import { Button, message, Popconfirm, Tooltip } from "antd";
import {
  genManagerTable,
  SimpleBooleanEdit,
  SimpleTextEdit,
  TypeManagerTableAddonButtonProps,
  TypeManagerTableAddonOperationProps,
  TypeTableEditRender,
} from "../components/ManagerTable";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { ConfigLineType, getDbInfoId, TypeDbInfo } from "../../../finder/types";
import { useFinderReady } from "../../hooks/webHooks";
import { isEmpty, isEqual } from "lodash";
import { getLocalContext } from "../../../finder/events/webEvent";
import { messageError } from "../uiTools";

const genApplyToSubDatabaseButton = (mode: "add" | "delete") => {
  const title =
    mode === "add"
      ? "Add Config to all sub databases? "
      : "Are you sure to remove config line from here and all sub databases? ";
  const text = mode === "add" ? "Apply" : "abolish";
  return (props: TypeManagerTableAddonButtonProps<TypeMsgConfigItem>) => {
    if (
      props.isReadonly ||
      props.isTableEdit ||
      props.isTableOnNew ||
      !props.records.length
    )
      return null;
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
  canApplyToSubDatabases = false
) => {
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
    canApplyToSubDatabases ? AddonButtons : undefined,
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
                data: v,
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
  true
);
export const FileNameToExcludeChildrenManager = genTypedConfigmanager(
  ConfigLineType.excludeChildrenFolderName,
  "File names to exclude children",
  undefined,
  true
);
export const RemoteWfinderManager = genTypedConfigmanager(
  ConfigLineType.remoteUrl,
  "Remote wfinder to connect to",
  ["disabled"]
);
