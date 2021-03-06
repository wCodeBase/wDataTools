import { LoadingOutlined } from "@ant-design/icons";
import { message, Modal, Spin, Switch, Tag as AntTag } from "antd";
import { isEmpty } from "lodash";
import React from "react";
import { EvFinderState, EvUiCmdResult } from "../../../finder/events/events";
import { executeUiCmd } from "../../../finder/events/eventTools";
import {
  getLocalRootContext,
  wEvGlobalState,
} from "../../../finder/events/webEvent";
import { isWebElectron } from "../../../finder/events/webEventTools";
import {
  ConfigLineType,
  defaultServerSetting,
  getDbInfoId,
  TypeServerSetting,
} from "../../../finder/types";
import { parseAddress } from "../../../tools/tool";
import {
  usePickBehaviorSubjectValue,
  useStableState,
  useSubjectCallback,
} from "../../hooks/hooks";
import { useFinderReady } from "../../hooks/webHooks";
import { defaultPropsFc } from "../../tools/fc";
import { SimpleInput } from "../components/SimpleInput";
import { Tag } from "../components/Tag";
import { messageError } from "../uiTools";

const defaultServerSettingProps = { titleClassName: "", className: "" };

export const MServerSettings = defaultPropsFc(
  defaultServerSettingProps,
  (props) => {
    const [state, setState] = useStableState(() => ({
      setting: defaultServerSetting,
      dataInited: false,
      listConfig: async () => {
        await messageError(
          executeUiCmd("listConfig", {
            cmd: "listConfig",
            data: { type: ConfigLineType.serverSetting },
          })
        );
      },
      saveConfig: async (setting: TypeServerSetting) => {
        await messageError(
          executeUiCmd("saveOrCreateConfig", {
            cmd: "saveOrCreateConfig",
            data: {
              type: ConfigLineType.serverSetting,
              content: "",
              jsonStr: JSON.stringify(setting),
            },
          })
        );
      },
    }));

    const [systemIps] = usePickBehaviorSubjectValue(
      EvFinderState,
      (v) => v.osInfo.systemIps
    );

    useFinderReady(() => {
      state.listConfig();
    });

    useSubjectCallback(EvUiCmdResult, (res) => {
      if (
        res.cmd === "listConfig" &&
        !res.result.error &&
        (res.result.oriData.type === ConfigLineType.serverSetting ||
          isEmpty(res.result.oriData)) &&
        getDbInfoId(res.context) === getDbInfoId(getLocalRootContext())
      ) {
        const configLine = res.result.results.find(
          (v) => v.type === ConfigLineType.serverSetting
        );
        let setting = defaultServerSetting;
        if (configLine?.jsonStr) {
          try {
            setting = JSON.parse(configLine.jsonStr);
          } catch (e) {
            message.error("Failed to parse current serverSetting");
          }
        }
        setState({ setting, dataInited: true });
      }
    });

    return (
      <div className={"flex flex-col " + props.className}>
        <div className={props.titleClassName + " flex flex-row items-center"}>
          Server setting
        </div>
        <Spin
          size="large"
          spinning={!state.dataInited}
          indicator={<LoadingOutlined />}
        >
          {!state.dataInited && <div className="h-32 bg-white" />}
          {state.dataInited && (
            <div className="bg-white p-2">
              <div className="my-1">
                <div>
                  <span className="text-base mr-4">Run server:</span>
                  <span>
                    <Switch
                      checkedChildren="on"
                      unCheckedChildren="off"
                      checked={state.setting.serverOpen}
                      onChange={(serverOpen) => {
                        state.saveConfig({ ...state.setting, serverOpen });
                      }}
                    />
                  </span>
                </div>
              </div>
              {/* Listening address setting */}
              <div className="my-1">
                <div className="text-base">Listen to:</div>
                <div className="ml-6 flex flex-row flex-wrap items-center">
                  {state.setting.bindAddressList.map((v) => {
                    return (
                      <Tag
                        className="text-sm"
                        onClose={
                          state.setting.bindAddressList.length > 1 &&
                          (async () => {
                            const confirm = await new Promise((res) => {
                              Modal.confirm({
                                closable: true,
                                maskClosable: true,
                                title: (
                                  <div className="mr-2">
                                    Delete server address config:{" "}
                                    <span className="p-1 font-bold">{v}</span>?
                                  </div>
                                ),
                                onOk: () => res(true),
                                onCancel: () => res(false),
                              });
                            });
                            if (confirm) {
                              await state.saveConfig({
                                ...state.setting,
                                bindAddressList:
                                  state.setting.bindAddressList.filter(
                                    (address) => address !== v
                                  ),
                              });
                            }
                          })
                        }
                        key={v}
                      >
                        <span>{v}</span>
                      </Tag>
                    );
                  })}
                  <span className="mx-1">
                    <SimpleInput
                      className="w-auto"
                      placeholder="Enter new address here"
                      onSubmit={async (val) => {
                        val = val.trim();
                        const { host, port } = parseAddress(val);
                        const address = host + ":" + port;
                        if (!host || !port) {
                          message.error("Illegal address inputed.");
                        } else if (
                          state.setting.bindAddressList.find(
                            (v) => v === address
                          )
                        ) {
                          message.warn("Address already exist!");
                        } else {
                          state.saveConfig({
                            ...state.setting,
                            bindAddressList:
                              state.setting.bindAddressList.concat(address),
                          });
                          return true;
                        }
                        return false;
                      }}
                    />
                  </span>
                  {systemIps?.length && (
                    <div className="mt-1 opacity-80 text-gray-800">
                      <span className="font-bold">Current system ips: </span>
                      {systemIps
                        .filter((v) => !v.includes(":"))
                        .map((v) => (
                          <AntTag key={v}>{v}</AntTag>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AllowIps setting */}
              <div className="my-1">
                <div className="text-base">Allow ips:</div>
                <div className="ml-6 flex flex-row flex-wrap items-center">
                  {state.setting.allowIps.map((v) => {
                    return (
                      <Tag
                        className="text-sm"
                        onClose={async () => {
                          const confirm = await new Promise((res) => {
                            Modal.confirm({
                              closable: true,
                              maskClosable: true,
                              title: (
                                <div className="mr-2">
                                  Delete allow ip regular expression:
                                  <span className="p-1 font-bold">{v}</span>?
                                </div>
                              ),
                              onOk: () => res(true),
                              onCancel: () => res(false),
                            });
                          });
                          if (confirm) {
                            await state.saveConfig({
                              ...state.setting,
                              allowIps: state.setting.allowIps.filter(
                                (ip) => ip !== v
                              ),
                            });
                          }
                        }}
                        key={v}
                      >
                        <span>{v}</span>
                      </Tag>
                    );
                  })}
                  <span className="mx-1">
                    <SimpleInput
                      className="w-auto"
                      placeholder="Enter new ip regexp"
                      onSubmit={async (val) => {
                        if (state.setting.allowIps.find((v) => v === val)) {
                          message.warn(
                            "Allow ip regular expression already exist!"
                          );
                        } else {
                          state.saveConfig({
                            ...state.setting,
                            allowIps: state.setting.allowIps.concat(val),
                          });
                          return true;
                        }
                        return false;
                      }}
                    />
                  </span>
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

export const ServerSettings = defaultPropsFc(
  defaultServerSettingProps,
  (props) => {
    // Only in electron root context can change server settings.
    if (!isWebElectron || wEvGlobalState.value.contextStack.length > 1)
      return null;
    return <MServerSettings {...props} />;
  },
  true
);
