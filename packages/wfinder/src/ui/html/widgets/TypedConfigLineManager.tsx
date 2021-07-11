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
import { genManagerTable, SimpleTextEdit } from "../components/ManagerTable";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { ConfigLineType } from "../../../finder/types";
import { Config } from "../../../finder/common";
import { useEventReady } from "../../hooks/webHooks";

const genTypedConfigmanager = (
  type: ConfigLineType,
  tableTitle: string | JSX.Element
) => {
  const TypedConfigTable = genManagerTable<TypeMsgConfigItem>(
    ["content", "updatedAt"],
    { content: SimpleTextEdit },
    { content: SimpleTextEdit },
    simpleGetKey,
    () => ({
      id: -1,
      content: "",
      updatedAt: new Date(),
      dbInfo: EvDefaultDbInfo.value,
      type,
    })
  );

  return defaultPropsFc(
    { className: "", titleClassName: "" },
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
            }).catch((e) => {
              message.error(String(e));
              return null;
            });
            if (res) await state.listConfig();
            return !!res;
          },
          listConfig: async () => {
            const res = await executeUiCmd("listConfig", {
              cmd: "listConfig",
              data: { type },
            }).catch((e) => {
              message.error(String(e));
              return null;
            });
            if (res) setState({ configs: res.result.results });
          },
          checkBusy: () => {
            if (state.waitingForCmdResult)
              message.warn("Busy now, pleace waiting...");
            return state.waitingForCmdResult;
          },
        };
        return res;
      });

      useEventReady(() => {
        state.listConfig();
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
