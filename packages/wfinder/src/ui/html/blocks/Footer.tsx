import React from "react";
import { LoadingOutlined } from "@ant-design/icons";
import { useFinderStatus } from "../../../finder/events/events";
import { BUSY_FINDER_STATES, FinderStatus } from "../../../finder/events/types";

export const Footer = () => {
  const [finderStatus, subject] = useFinderStatus();
  return (
    <div className="flex justify-start bg-gradient-to-br from-blueGray-700 to-blueGray-500 shadow-sm text-white p-0.5 px-1">
      <div className="flex items-center">
        Finder state: {FinderStatus[finderStatus.status]}
        {BUSY_FINDER_STATES.includes(finderStatus.status) && (
          <LoadingOutlined className="m-1" />
        )}
      </div>
    </div>
  );
};
