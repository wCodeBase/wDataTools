import { PlusOutlined } from "@ant-design/icons";
import { Button } from "antd";
import React from "react";
import { defaultPropsFc } from "../../tools/fc";

export const Empty = defaultPropsFc(
  {
    description: "No Data",
    onAdd: null as null | (() => Promise<void>),
    className: "",
  },
  (props) => {
    return (
      <div
        className={
          "w-full p-2 flex flex-col justify-center items-center bg-warmGray-50" +
          props.className
        }
      >
        <div className="text-gray-500 text-lg mt-4 mb-2">
          {props.description}
        </div>
        {props.onAdd && (
          <Button onClick={props.onAdd} type="primary" className="mt-1 mb-4">
            <div className="flex flex-row justify-center items-center">
              <PlusOutlined />
              Add
            </div>
          </Button>
        )}
      </div>
    );
  },
  true
);
