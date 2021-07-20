import { Tooltip } from "antd";
import React from "react";
import {
  WebEventStatus,
  wEvEventStatus,
} from "../../../finder/events/webEvent";
import { useBehaviorSubjectValue } from "../../hooks/hooks";
import { defaultPropsFc } from "../../tools/fc";

const hintMap: Partial<Record<WebEventStatus, string>> = {
  [WebEventStatus.none]: "Server is not connected yet",
  [WebEventStatus.connecting]: "Connecting to server",
  [WebEventStatus.connected]: "Server is connected",
};

const failedHint = "Failed to connet to server.";

export const ConnectionLight = defaultPropsFc(
  { className: "" },
  (props) => {
    const [status] = useBehaviorSubjectValue(wEvEventStatus);

    return (
      <div className={"flex justify-center items-center " + props.className}>
        {status !== WebEventStatus.connected && (
          <div className="text-red-500">Not Connected</div>
        )}
        <Tooltip title={hintMap[status] || failedHint}>
          <div className="p-1">
            <div
              className={
                "w-3 h-3 rounded-full transition-colors shadow-lg duration-200 " +
                (status === WebEventStatus.none
                  ? "bg-gray-400"
                  : status === WebEventStatus.connecting
                  ? "bg-green-300 animate-ping"
                  : status === WebEventStatus.connected
                  ? "bg-green-400"
                  : "bg-red-500 ")
              }
            />
          </div>
        </Tooltip>
      </div>
    );
  },
  true
);
