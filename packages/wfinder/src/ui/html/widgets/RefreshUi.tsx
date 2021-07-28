import { Button } from "antd";
import React from "react";
import { defaultPropsFc } from "../../tools/fc";

export const RefreshUi = defaultPropsFc(
  { className: "" },
  (props) => {
    return (
      <div
        className={
          "flex flex-row justify-center items-center p-4 bg-gray-500 shadow-sm " +
          props.className
        }
      >
        <Button
          type="primary"
          danger
          onClick={() => {
            location.reload();
          }}
        >
          Refresh ui
        </Button>
      </div>
    );
  },
  true
);
