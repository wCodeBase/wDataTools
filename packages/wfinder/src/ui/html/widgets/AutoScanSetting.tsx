import { LoadingOutlined } from "@ant-design/icons";
import { Button, InputNumber, message, Spin } from "antd";
import { isEmpty } from "lodash";
import React from "react";
import { JsonMore, useStableState, useSubjectCallback } from "wjstools";
import { EvUiCmdResult } from "../../../finder/events/events";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { getLocalRootContext } from "../../../finder/events/webEvent";
import {
  ConfigLineType,
  defaultAutoScanSetting,
  getDbInfoId,
  isScanDurationAvailable,
  TypeAutoScanSetting,
} from "../../../finder/types";
import { useFinderReady } from "../../hooks/webHooks";
import { defaultPropsFc } from "../../tools/fc";
import { messageError } from "../uiTools";

export const AutoScanSetting = defaultPropsFc(
  { titleClassName: "", className: "" },
  (props) => {
    const [state, setState] = useStableState(() => ({
      setting: defaultAutoScanSetting,
      dataInited: false,
      newDuration: 1,
      saving: false,
      listConfig: async () => {
        await messageError(
          executeUiCmd("listConfig", {
            cmd: "listConfig",
            data: { type: ConfigLineType.autoRescan },
          })
        );
      },
      saveConfig: async (setting: TypeAutoScanSetting) => {
        setState({ saving: true });
        await messageError(
          executeUiCmd("saveOrCreateConfig", {
            cmd: "saveOrCreateConfig",
            data: {
              type: ConfigLineType.autoRescan,
              content: "",
              jsonStr: JsonMore.stringify(setting),
            },
          })
        );
        setState({ saving: false });
      },
    }));

    useFinderReady(() => {
      state.listConfig();
    });

    useSubjectCallback(EvUiCmdResult, (res) => {
      if (
        res.cmd === "listConfig" &&
        !res.result.error &&
        (res.result.oriData.type === ConfigLineType.autoRescan ||
          isEmpty(res.result.oriData)) &&
        getDbInfoId(res.context) === getDbInfoId(getLocalRootContext())
      ) {
        const configLine = res.result.results.find(
          (v) => v.type === ConfigLineType.autoRescan
        );
        let setting = defaultAutoScanSetting;
        if (configLine?.jsonStr) {
          try {
            setting = JsonMore.parse(configLine.jsonStr) as TypeAutoScanSetting;
          } catch (e) {
            message.error("Failed to parse current serverSetting");
          }
        }
        setState({ setting, dataInited: true });
      }
    });

    const durationAvailable = isScanDurationAvailable(state.setting.duration);

    return (
      <div className={"flex flex-col " + props.className}>
        <div className={props.titleClassName + " flex flex-row items-center"}>
          Auto scan setting
        </div>
        <Spin
          size="large"
          spinning={!state.dataInited}
          indicator={<LoadingOutlined />}
        >
          {!state.dataInited && <div className="h-32 bg-white" />}
          {state.dataInited && (
            <div className="bg-white p-2">
              <div className="my-1 font-bold">
                <span className="pr-1">Current auto scan duration: </span>
                <span className={!durationAvailable ? "text-red-500" : ""}>
                  {!durationAvailable
                    ? "Never"
                    : `${state.setting.duration} hour`}
                </span>
              </div>
              <div className="my-1">
                <span className="font-bold pr-1">
                  Set new auto scan duration (hour):{" "}
                </span>
                <InputNumber
                  min={0}
                  defaultValue={1}
                  onChange={(v) => setState({ newDuration: v })}
                />
                <div className="flex justify-end my-1">
                  <Button
                    className="mr-1"
                    type="primary"
                    size="small"
                    loading={state.saving}
                    onClick={() => {
                      state.saveConfig({ duration: state.newDuration });
                    }}
                  >
                    Save
                  </Button>
                  {durationAvailable && (
                    <Button
                      type="primary"
                      size="small"
                      danger
                      loading={state.saving}
                      onClick={() => {
                        state.saveConfig({ duration: Infinity });
                      }}
                    >
                      Turn Off
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Spin>
      </div>
    );
  },
  true
);
