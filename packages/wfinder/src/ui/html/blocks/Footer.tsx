import React from "react";
import { LoadingOutlined } from "@ant-design/icons";
import { useFinderState } from "../../../finder/events/events";
import { BUSY_FINDER_STATES, FinderState } from "../../../finder/events/types";

export const Footer = () => {
  const [finderState, subject] = useFinderState();
  return (
    <div className="flex justify-start bg-gradient-to-br from-blueGray-700 to-blueGray-500 shadow-sm text-white p-0.5 px-1">
      <div className="flex items-center">
        Finder state: {FinderState[finderState]}
        {BUSY_FINDER_STATES.includes(finderState) && (
          <LoadingOutlined className="m-1" />
        )}
      </div>
    </div>
  );
};
