import React from "react";
import { LoadingOutlined } from "@ant-design/icons";
import {
  EvDatabaseInfos,
  EvFileInfoChange,
  EvUiCmdResult,
  useFinderStatus,
} from "../../../finder/events/events";
import { BUSY_FINDER_STATES, FinderStatus } from "../../../finder/events/types";
import { defaultPropsFc } from "../../tools/fc";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { executeUiCmd } from "../../../finder/events/eventTools";
import {
  getLocalContext,
  getLocalRootContext,
  wEvFinderReady,
} from "../../../finder/events/webEvent";
import { getDbInfoId } from "../../../finder/types";
import { ConsoleOutput } from "../widgets/ConsoleOutput";

export const TotalFile = defaultPropsFc({ className: "" }, (props) => {
  const [state, setState] = useStableState(() => ({
    total: 0,
    getTotal: async () => {
      if (getLocalContext() !== getLocalRootContext()) {
        await executeUiCmd("countAllFileInfo", {
          cmd: "countAllFileInfo",
          context: getLocalContext(),
        });
      }
    },
  }));

  useSubjectCallback(EvDatabaseInfos, (v) => {
    if (getLocalContext() === getLocalRootContext()) {
      setState({ total: v.fileInfoCount });
    }
  });

  useSubjectCallback(EvFileInfoChange, () => {
    if (!wEvFinderReady.value) return;
    state.getTotal();
  });

  useSubjectCallback(EvUiCmdResult, (msg) => {
    if (
      msg.cmd === "countAllFileInfo" &&
      !msg.result.error &&
      getDbInfoId(msg.context) === getDbInfoId(getLocalContext())
    ) {
      setState({ total: msg.result.total });
    }
  });

  useSubjectCallback(wEvFinderReady, (ready) => {
    if (ready) state.getTotal();
  });

  return (
    <div className={" " + props.className}>
      <span className="font-bold">Total file: </span>
      <span>{state.total}</span>
    </div>
  );
});

export const FinderStatusIndicator = defaultPropsFc(
  { className: "" },
  (props) => {
    const [finderStatus, subject] = useFinderStatus();
    const status = finderStatus.scanContextIdAndPathSet.size
      ? FinderStatus.scanning
      : finderStatus.searchContextIdSet.size
      ? FinderStatus.searching
      : finderStatus.status;
    return (
      <div className={"flex items-center " + props.className}>
        <span className="font-bold">Finder state:</span> {FinderStatus[status]}
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
