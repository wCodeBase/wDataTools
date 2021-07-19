import { InfoCircleFilled } from "@ant-design/icons";
import { Tooltip } from "antd";
import { RenderFunction } from "antd/lib/tooltip";
import React from "react";

export const SubDatabaseHint = React.memo(
  (props: {
    hint?: React.ReactNode | RenderFunction;
    className?: string;
    showIcon?: boolean;
  }) => {
    const content = (
      <span
        className={
          "bg-orange-700 p-0.5 text-xs cursor-pointer " +
          (props.className || "")
        }
      >
        sub database
        {props.showIcon && <InfoCircleFilled className="pl-0.5" />}
      </span>
    );
    if (!props.hint) return content;
    return <Tooltip title={props.hint}>{content}</Tooltip>;
  }
);
