import { LoadingOutlined } from "@ant-design/icons";
import React from "react";
import { useFinderStatus } from "../../../finder/events/events";
import { BUSY_FINDER_STATES, FinderStatus } from "../../../finder/events/types";
import { wEvGlobalState } from "../../../finder/events/webEvent";
import { useBehaviorSubjectValue } from "wjstools";
import { defaultPropsFc } from "../../tools/fc";
import { ConsoleOutput } from "../widgets/ConsoleOutput";

export const TotalFile = defaultPropsFc({ className: "" }, (props) => {
  const [state] = useBehaviorSubjectValue(wEvGlobalState);

  return (
    <div className={" " + props.className}>
      {/* <span className="font-bold">Total file: </span> */}
      {state.totalLoading ? (
        <LoadingOutlined />
      ) : (
        <span>
          {state.total} files
          {!!state.remoteTotal && (
            <span className="hidden sm:inline">
              , {state.localTotal} in local
            </span>
          )}
        </span>
      )}
    </div>
  );
});

export const FinderStatusIndicator = defaultPropsFc(
  { className: "" },
  (props) => {
    const [finderStatus] = useFinderStatus();
    const status = finderStatus.scanContextIdAndPathSet.size
      ? FinderStatus.scanning
      : finderStatus.searchContextIdSet.size
      ? FinderStatus.searching
      : finderStatus.status;
    return (
      <div className={"flex items-center " + props.className}>
        <span className="font-bold">
          <span className="hidden sm:inline mr-0.5">Finder state:</span>
          <span className="sm:hidden inline mr-0.5">State:</span>
        </span>{" "}
        {FinderStatus[status]}
        {!!BUSY_FINDER_STATES.includes(status) && (
          <LoadingOutlined className="m-1" />
        )}
      </div>
    );
  }
);
export const Footer = () => {
  return (
    <div className="flex flex-row items-center justify-start bg-gradient-to-br from-blueGray-700 to-blueGray-500 shadow-sm text-white px-1">
      <FinderStatusIndicator className="mr-3 flex-shrink-0" />
      <ConsoleOutput />
      <TotalFile className="mr-2 my-0.5 flex-shrink-0" />
    </div>
  );
};
