import { SyncOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import React, { useState } from "react";
import { defaultPropsFc } from "../../tools/fc";

export const RefreshIcon = defaultPropsFc(
  {
    className: "",
    title: "",
    onClick: async () => {
      void 0;
    },
  },
  (props) => {
    const [loading, setLoading] = useState(false);
    return (
      <Tooltip title={props.title || "Refresh"}>
        <a className={"inline-block mx-1 " + props.className}>
          <span
            className={"flex " + (loading ? "cursor-not-allowed " : "")}
            onClick={async () => {
              setLoading(true);
              await props.onClick();
              setLoading(false);
            }}
          >
            <SyncOutlined className={loading ? "animate-spin" : ""} />
          </span>
        </a>
      </Tooltip>
    );
  },
  true
);
