import { defaultPropsFc } from "./../../tools/fc";
import React from "react";
import { CloseOutlined } from "@ant-design/icons";

export const Tag = defaultPropsFc(
  {
    onClose: undefined as undefined | false | (() => void),
    className: "",
    closeClassName: "",
  },
  (props) => {
    return (
      <div
        className={
          "flex flex-row items-center px-1 m-1 rounded-sm shadow-sm border border-gray-400 " +
          props.className
        }
      >
        <span className="ml-1">{props.children}</span>
        {props.onClose && (
          <span
            onClick={props.onClose}
            className={
              "p-1 flex flex-row rounded-sm shadow-sm text-blue-600 hover:text-lightBlue-600 items-center cursor-pointer " +
              props.closeClassName
            }
          >
            <CloseOutlined />
          </span>
        )}
      </div>
    );
  },
  true
);
