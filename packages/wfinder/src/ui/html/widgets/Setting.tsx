import React from "react";
import {
  getLocalContext,
  wEvGlobalState,
} from "../../../finder/events/webEvent";
import { isWebElectron } from "../../../finder/events/webEventTools";
import { usePickBehaviorSubjectValue } from "wjstools";
import { About } from "../components/About";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { SubDatabaseHint } from "../components/SubDatabaseHint";
import { defaultPropsFc } from "./../../tools/fc";
import { DbIncludedManager } from "./DbIncludedManager";
import { RefreshUi } from "./RefreshUi";
import { ScanPathManager } from "./ScanPathManager";
import { ServerSettings } from "./ServerSettings";
import {
  AbsolutePathToExcludeManager,
  FileNameToExcludeChildrenManager,
  FileNameToExcludeManager,
  RelativePathToExcludeManager,
  RemoteWfinderManager,
} from "./TypedConfigLineManager";
import { AutoScanSetting } from "./AutoScanSetting";

const Segments = {
  ServerSettings,
  AutoScanSetting,
  ScanPathManager,
  FileNameToExcludeManager,
  FileNameToExcludeChildrenManager,
  RelativePathToExcludeManager,
  AbsolutePathToExcludeManager,
  DbIncludedManager,
  RemoteWfinderManager,
  About,
  ...(isWebElectron
    ? {
        RefreshUi,
      }
    : {}),
};

const SubDbSegments = {
  AutoScanSetting,
  ScanPathManager,
  FileNameToExcludeManager,
  FileNameToExcludeChildrenManager,
  RelativePathToExcludeManager,
  AbsolutePathToExcludeManager,
  DbIncludedManager,
  About,
};

export const Setting = defaultPropsFc(
  {
    className: "",
    segments: Object.entries(Segments),
    subDbSegments: Object.entries(SubDbSegments),
  },
  (props) => {
    const { segments, subDbSegments } = props;
    const [context] = usePickBehaviorSubjectValue(
      wEvGlobalState,
      getLocalContext
    );
    return (
      <div
        className={"flex flex-col shadow-sm overflow-hidden " + props.className}
      >
        <div className="flex flex-row items-center text-white text-lg font-bold bg-lightBlue-500 rounded-sm p-0.5 px-2 ">
          <span>Setting</span>
          {context?.isSubDb && (
            <SubDatabaseHint
              className="ml-1.5 flex flex-row items-center"
              hint="Only some settings available in sub databases."
              showIcon
            />
          )}
        </div>
        <div className="h-2 flex-shrink-0" />
        <div className="overflow-auto">
          {(context?.isSubDb ? subDbSegments : segments).map(
            ([name, Render], index) => {
              return (
                <div
                  key={name}
                  className={
                    "rounded-sm shadow-sm" +
                    (index < segments.length - 1 ? " mb-2 " : "")
                  }
                >
                  <ErrorBoundary>
                    <Render titleClassName="text-white text-base leading-6 bg-lightBlue-800 p-1 " />
                  </ErrorBoundary>
                </div>
              );
            }
          )}
        </div>
      </div>
    );
  },
  true
);
