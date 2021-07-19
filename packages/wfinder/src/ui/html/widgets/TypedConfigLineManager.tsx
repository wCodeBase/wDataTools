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
import { isEqual } from "lodash";
import { getLocalContext } from "../../../finder/events/webEvent";

const genTypedConfigmanager = (
  type: ConfigLineType,
  tableTitle: string | JSX.Element,
  moreColumns: (keyof TypeMsgConfigItem)[] = []
) => {
  const TypedConfigTable = genManagerTable<TypeMsgConfigItem>(
    ["content", "updatedAt", ...moreColumns],
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
            const res = await executeUiCmd("deleteConfig", {
              cmd: "deleteConfig",
              data: v,
            }).catch((e) => {
              message.error(String(e));
              return null;
            });
            if (res) await state.listConfig();
          },
          addNew: async (v: TypeMsgConfigItem) => {
            const res = await executeUiCmd("addConfig", {
              cmd: "addConfig",
              data: v,
              context: props.contexted ? getLocalContext() : undefined,
            }).catch((e) => {
              message.error(String(e));
              return null;
            });
            if (res) await state.listConfig();
            return !!res;
          },
          save: async (v: TypeMsgConfigItem) => {
            const res = await executeUiCmd("saveConfig", {
              cmd: "saveConfig",
              data: v,
              context: props.contexted ? getLocalContext() : undefined,
            }).catch((e) => {
              message.error(String(e));
              return null;
            });
            if (res) await state.listConfig();
            return !!res;
          },
          listConfig: async () => {
            await executeUiCmd("listConfig", {
              cmd: "listConfig",
              data: listConfigData,
              context: props.contexted ? getLocalContext() : undefined,
            }).catch((e) => {
              message.error(String(e));
              return null;
            });
          },
          checkBusy: () => {
            if (state.waitingForCmdResult)
              message.warn("Busy now, pleace waiting...");
            return state.waitingForCmdResult;
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
          isEqual(listConfigData, res.result.oriData) &&
          getDbInfoId(res.context) === getDbInfoId(getLocalContext())
        ) {
          setState({ configs: res.result.results });
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
