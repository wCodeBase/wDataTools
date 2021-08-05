import { SettingOutlined } from "@ant-design/icons";
import { Button, Drawer } from "antd";
import React from "react";
import { isWebElectron } from "../../../finder/events/webEventTools";
import { useStableState } from "wjstools";
import { useWindowSize } from "wjstools";
import { ConnectionLight } from "../components/ConnectionLight";
import { LinkedRemoteIndicator } from "../components/LinkedRemote";
import { ServerLight } from "../components/ServerLight";
import { ContextIndicator } from "../widgets/Contexts";
import { Setting } from "../widgets/Setting";

const SettingButton = React.memo(() => {
  const [state, setState] = useStableState(() => ({
    showSetting: false,
    hideSetting: () => {
      setState({ showSetting: false });
    },
  }));

  const windowSize = useWindowSize();

  return (
    <>
      <Button
        type="primary"
        size="middle"
        onClick={() => {
          setState({ showSetting: true });
        }}
      >
        <div className="flex items-center">
          <SettingOutlined />
          <div className="sm:block hidden pl-1">Settings</div>
        </div>
      </Button>

      <Drawer
        closable={false}
        width={
          windowSize.width > 1280
            ? 1024
            : windowSize.width > 640
            ? "80%"
            : windowSize.width > 540
            ? "90%"
            : "100%"
        }
        bodyStyle={{ padding: 0 }}
        visible={state.showSetting}
        onClose={state.hideSetting}
      >
        <div className="flex flex-col h-full overflow-y-auto p-3 bg-gradient-to-tr from-cyan-700 to-lightBlue-700 ">
          <div className="flex justify-end">
            <Button type="primary" onClick={state.hideSetting} className="mb-2">
              Close
            </Button>
          </div>
          <Setting className="flex-grow" />
        </div>
      </Drawer>
    </>
  );
});

export const Header = () => {
  return (
    <div className="flex flex-row w-full flex-shrink-0 truncate bg-gradient-to-br from-blueGray-500 to-blueGray-700 shadow-sm text-white px-2 py-0.5">
      <ContextIndicator />
      <div className="flex-grow mx-2 h-8" />
      <div className="lg:hidden">
        <SettingButton />
      </div>
      <LinkedRemoteIndicator className="ml-2" />
      {isWebElectron && <ServerLight className="ml-2" />}
      {!isWebElectron && <ConnectionLight className="pl-1" />}
    </div>
  );
};
