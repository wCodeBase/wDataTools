import React from "react";
import { SettingOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { Modal, Drawer } from "antd";
import { useStableState } from "../../hooks/hooks";
import { Setting } from "../widgets/Setting";

const SettingButton = React.memo(() => {
  const [state, setState] = useStableState(() => ({
    showSetting: false,
    hideSetting: () => {
      console.log("close");
      setState({ showSetting: false });
    },
  }));
  return (
    <>
      <Button
        type="primary"
        onClick={() => {
          console.log("click");
          setState({ showSetting: true });
        }}
      >
        <div className="flex items-center">
          <SettingOutlined className="pr-1" />
          Settings
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
            <Button type="primary">Close</Button>
          </div>
          <Setting className="flex-grow" />
        </div>
      </Drawer>
    </>
  );
});

export const Header = () => {
  return (
    <div className="flex bg-gradient-to-br from-blueGray-500 to-blueGray-700 shadow-sm text-white p-2">
      <div>Header</div>
      <div className="flex-grow" />
      <div className="lg:hidden">
        <SettingButton />
      </div>
    </div>
  );
};
