import { defaultPropsFc } from "./../../tools/fc";
import React, { useEffect } from "react";
import {
  EvUiCmdResult,
  EvUiCmd,
  EvDefaultDbInfo,
} from "../../../finder/events/events";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { TypeMsgConfigItem } from "../../../finder/events/types";
import { message } from "antd";
import {
  genManagerTable,
  SimpleBooleanEdit,
  SimpleTextEdit,
  TypeTableEditRender,
} from "../components/ManagerTable";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { ConfigLineType, getDbInfoId } from "../../../finder/types";
import { useFinderReady } from "../../hooks/webHooks";
import { isEmpty, isEqual } from "lodash";
import { getLocalContext } from "../../../finder/events/webEvent";
import { messageError } from "../uiTools";

const genTypedConfigmanager = (
  type: ConfigLineType,
  tableTitle: string | JSX.Element,
  moreColumns: (keyof TypeMsgConfigItem)[] = []
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
      dbInfo: EvDefaultDbInfo.value,
      type,
    })
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
          />
        </div>
      );
    },
    true
  );
};

export const FileNameToExcludeManager = genTypedConfigmanager(
  ConfigLineType.excludeFileName,
  "File names to exclude"
);
export const FileNameToExcludeChildrenManager = genTypedConfigmanager(
  ConfigLineType.excludeChildrenFolderName,
  "File names to exclude children"
);
export const RemoteWfinderManager = genTypedConfigmanager(
  ConfigLineType.remoteUrl,
  "Remote wfinder to connect to",
  ["disabled"]
);
