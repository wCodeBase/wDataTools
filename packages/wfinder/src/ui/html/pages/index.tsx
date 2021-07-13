import React from "react";
import { useEffect } from "react";
import { Body } from "../blocks/Body";
import { Footer } from "../blocks/Footer";
import { Header } from "../blocks/Header";
import {
  EvConsole,
  EvFinderReady,
  EvUiCmd,
  EvUiCmdResult,
} from "../../../finder/events/events";
import { webInitEvent } from "../../../finder/events/webEventTools";
import { executeUiCmdInterceptors } from "../../../finder/events/eventTools";
import {
  WebEventStatus,
  wEvEventStatus,
} from "../../../finder/events/webEvent";
import { Button, Input, Modal, Radio, Tooltip } from "antd";
import { showModal, TypeShowModalHandle } from "../uiTools";

export const FinderUi = () => {
  useEffect(() => {
    webInitEvent();
    const uiCmdInterceptor = async () => {
      if (wEvEventStatus.value !== WebEventStatus.connected)
        throw new Error("Server is not connected yet.");
      return undefined;
    };
    executeUiCmdInterceptors.add(uiCmdInterceptor);
    let handle: TypeShowModalHandle | undefined;
    const subscribes = [
      EvConsole.subscribe((val) => {
        console.warn(val);
      }),
      EvFinderReady.subscribe((ready) => {
        if (ready && handle) {
          handle.destory();
          handle = undefined;
        }
      }),
      EvUiCmd.subscribe(async (msg) => {
        if (msg?.cmd === "requestChooseFinderRoot") {
          if (handle) {
            handle.destory();
            handle = undefined;
          }
          await new Promise((res) => {
            const { cwd, userDataDir, message } = msg.data;
            let inputValue = "";
            let selectPath: number | string = "";
            handle = showModal({
              title: (
                <div className="text-orange-500">
                  Please choose a directory to store database file.
                </div>
              ),
              centered: true,
              width: window.innerWidth > 1000 ? 800 : "85%",
              footer: null,
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
                      <div className="pl-6 pr-2">
                        <Input
                          value={inputValue}
                          onChange={(ev) => {
                            inputValue = ev.target.value;
                            handle?.update();
                          }}
                        />
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
            });
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
