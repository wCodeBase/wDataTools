import React from "react";
import { useEffect } from "react";
import { Body } from "../blocks/Body";
import { Footer } from "../blocks/Footer";
import { Header } from "../blocks/Header";
import {
  EvConsole,
  EvFinderReady,
  EvFinderState,
  EvUiCmd,
  EvUiCmdMessage,
  EvUiCmdResult,
} from "../../../finder/events/events";
import { isElectron, webInitEvent } from "../../../finder/events/webEventTools";
import {
  executeUiCmd,
  executeUiCmdInterceptors,
} from "../../../finder/events/eventTools";
import {
  WebEventStatus,
  wEvEventStatus,
  wEvGlobalState,
} from "../../../finder/events/webEvent";
import { Button, Input, Modal, Radio, Tooltip } from "antd";
import { showModal, TypeShowModalHandle } from "../uiTools";
import { InfoCircleOutlined } from "@ant-design/icons";
import { TypeUiMsgData } from "../../../finder/events/types";

export const FinderUi = () => {
  useEffect(() => {
    const globalStateSub = EvFinderState.subscribe(async (state) => {
      if (state.config) {
        globalStateSub.unsubscribe();
        wEvGlobalState.next({
          contextStack: [
            {
              localContexts: [state.config],
            },
          ],
        });
      }
    });
    webInitEvent();
    const uiCmdInterceptor = async () => {
      if (wEvEventStatus.value !== WebEventStatus.connected)
        throw new Error("Server is not connected yet.");
      return undefined;
    };
    executeUiCmdInterceptors.add(uiCmdInterceptor);
    let handle: TypeShowModalHandle | undefined;
    let currentUiCmdMsg: TypeUiMsgData | undefined;
    const subscribes = [
      EvConsole.subscribe((val) => {
        console.warn(val);
      }),
      EvUiCmdMessage.subscribe((msg) => {
        console.log("UiCmdMessage", msg);
      }),
      EvFinderReady.subscribe((ready) => {
        if (ready && handle) {
          handle.destory();
          handle = undefined;
        }
      }),
      EvUiCmd.subscribe(async (msg) => {
        if (msg?.cmd === "requestChooseFinderRoot") {
          if (currentUiCmdMsg?.tag && msg.tag === currentUiCmdMsg?.tag) return;
          currentUiCmdMsg = msg;
          if (handle) {
            handle.destory();
            handle = undefined;
          }
          await new Promise((res) => {
            const { cwd, userDataDir, message } = msg.data;
            let inputValue = "";
            let selectPath: number | string = "";
            handle = showModal(() => ({
              title: (
                <div className="text-orange-500 flex items-center">
                  <div className="text-2xl flex items-center mr-2">
                    <InfoCircleOutlined />
                  </div>
                  <div className="text-xl font-semibold">
                    Please choose a directory to store database file.
                  </div>
                </div>
              ),
              centered: true,
              width: window.innerWidth > 1000 ? 800 : "85%",
              footer: null,
              closable: false,
              render: () => (
                <div className="flex flex-col">
                  {message && (
                    <div className="rounded-sm p-2 bg-amber-300 break-all">
                      {message}
                    </div>
                  )}
                  <Radio.Group
                    className="flex-grow"
                    value={selectPath}
                    onChange={(v) => {
                      selectPath = v.target.value;
                      handle?.update();
                    }}
                  >
                    <div className="my-2">
                      <Radio value={cwd}>
                        <span className="text-base mr-1">Current path:</span>
                        <div className="break-all">{cwd}</div>
                      </Radio>
                    </div>
                    {userDataDir && (
                      <div className="my-2">
                        <Radio value={userDataDir}>
                          <span className="text-base mr-1">
                            User data folder:
                          </span>
                          <div className="break-all">{userDataDir}</div>
                        </Radio>
                      </div>
                    )}
                    <div className="my-2">
                      <Radio value={1}>
                        <span className="text-base mr-1">Another path:</span>
                      </Radio>
                      <div className="pl-6 pr-2 flex flex-row">
                        <Input
                          disabled={selectPath !== 1}
                          value={inputValue}
                          onChange={(ev) => {
                            inputValue = ev.target.value;
                            handle?.update();
                          }}
                        />
                        {isElectron && (
                          <Button
                            disabled={selectPath !== 1}
                            type="primary"
                            className="px-2 ml-3"
                            onClick={async () => {
                              const res = await executeUiCmd(
                                "requestPickLocalPath",
                                {
                                  cmd: "requestPickLocalPath",
                                  data: {
                                    title: "Choose wfinder initialization path",
                                    properties: ["createDirectory"],
                                  },
                                },
                                Infinity
                              );
                              if (res.result.path) {
                                inputValue = res.result.path;
                                handle?.update();
                                EvUiCmd.next({ ...msg });
                              }
                            }}
                          >
                            Pick a path
                          </Button>
                        )}
                      </div>
                    </div>
                  </Radio.Group>
                  <div className="flex justify-end px-1 pt-3">
                    <Button
                      type="primary"
                      size="large"
                      disabled={
                        !selectPath || (selectPath === 1 && !inputValue)
                      }
                      onClick={() => {
                        EvUiCmdResult.next({
                          cmd: "requestChooseFinderRoot",
                          tag: msg.tag,
                          result: {
                            finderRoot:
                              typeof selectPath === "number"
                                ? inputValue
                                : selectPath,
                          },
                        });
                        handle?.destory();
                        handle = undefined;
                      }}
                    >
                      <div className="px-2">OK</div>
                    </Button>
                  </div>
                </div>
              ),
            }));
          });
        }
      }),
    ];
    return () => {
      executeUiCmdInterceptors.delete(uiCmdInterceptor);
      subscribes.forEach((v) => v.unsubscribe());
    };
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <Body className="flex-grow" />
      <Footer />
    </div>
  );
};
