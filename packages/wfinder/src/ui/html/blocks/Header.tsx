import React from "react";
import { SettingOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { Modal, Drawer } from "antd";
import {
  useBehaviorSubjectValue,
  usePickBehaviorSubjectValue,
  useStableState,
} from "../../hooks/hooks";
import { Setting } from "../widgets/Setting";
import { ConnectionLight } from "../components/ConnectionLight";
import { isElectron } from "../../../finder/events/webEventTools";
import { ContextIndicator } from "../widgets/Contexts";
import { LinkedRemoteIndicator } from "../components/LinkedRemote";

const SettingButton = React.memo(() => {
  const [state, setState] = useStableState(() => ({
    showSetting: false,
    hideSetting: () => {
      setState({ showSetting: false });
    },
  }));
  return (
    <>
      <Button
        type="primary"
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
        width="80%"
        bodyStyle={{ padding: 0 }}
        visible={state.showSetting}
        onClose={state.hideSetting}
      >
        <div className="flex flex-col h-full overflow-y-auto p-3 bg-gradient-to-tr from-cyan-700 to-lightBlue-700">
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
    <div className="flex flex-row w-full truncate bg-gradient-to-br from-blueGray-500 to-blueGray-700 shadow-sm text-white p-2">
      <ContextIndicator />
      <div className="flex-grow mx-2" />
      <div className="lg:hidden">
        <SettingButton />
      </div>
      <LinkedRemoteIndicator className="ml-2" />
      {!isElectron && <ConnectionLight className="pl-1" />}
    </div>
  );
};
