import {
  ApartmentOutlined,
  ApiFilled,
  ExclamationCircleFilled,
  ExclamationCircleOutlined,
  HddFilled,
} from "@ant-design/icons";
import { Popover, Tooltip } from "antd";
import { isEmpty } from "lodash";
import React from "react";
import { useRef } from "react";
import { EvFinderState } from "../../../finder/events/events";
import { usePickBehaviorSubjectValue } from "../../hooks/hooks";
import { defaultPropsFc } from "../../tools/fc";

export const ServerStatePannel = defaultPropsFc(
  { className: "" },
  (props) => {
    const [serverState] = usePickBehaviorSubjectValue(
      EvFinderState,
      (v) => v.servers
    );
    return (
      <div className={"max-w-vw3/5 max-h-vh3/5 " + props.className}>
        <div className="text-base font-bold py-1">Server state:</div>
        <div className="ml-4">
          {Object.entries(serverState).map(([url, state]) => {
            return (
              <div
                key={url}
                className="flex flex-row items-center justify-between py-1"
              >
                <span className="mr-2 font-bold">{url}:</span>
                <span>
                  {state.error ? (
                    <Tooltip title={state.error}>
                      <span className="text-red-500 font-bold cursor-pointer flex flex-row items-center">
                        Error <ExclamationCircleOutlined className="ml-1" />
                      </span>
                    </Tooltip>
                  ) : (
                    <span className="text-green-400 font-bold">Running</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  true
);

export const ServerLight = defaultPropsFc(
  { className: "" },
  (props) => {
    const [serverState] = usePickBehaviorSubjectValue(
      EvFinderState,
      (v) => v.servers
    );
    const popRef = useRef<HTMLElement>(null);
    if (isEmpty(serverState)) return null;
    return (
      <Popover
        content={<ServerStatePannel />}
        placement="bottomRight"
        getPopupContainer={() => popRef.current || document.body}
      >
        <span
          ref={popRef}
          className={
            "flex flex-row items-center cursor-pointer rounded-md p-1 shadow-sm transition-colors hover:bg-gray-700 " +
            (Object.values(serverState).find((v) => v.error)
              ? "text-red-500 "
              : "text-green-500 ") +
            props.className
          }
        >
          <ApiFilled />
        </span>
      </Popover>
    );
  },
  true
);
