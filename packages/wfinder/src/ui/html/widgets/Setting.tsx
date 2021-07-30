import { defaultPropsFc } from "./../../tools/fc";
import React from "react";
import { ScanPathManager } from "./ScanPathManager";
import {
  AbsolutePathToExcludeManager,
  FileNameToExcludeChildrenManager,
  FileNameToExcludeManager,
  RemoteWfinderManager,
} from "./TypedConfigLineManager";
import { usePickBehaviorSubjectValue } from "../../hooks/hooks";
import {
  getLocalContext,
  wEvGlobalState,
} from "../../../finder/events/webEvent";
import { Tag, Tooltip } from "antd";
import { InfoCircleFilled, InfoCircleOutlined } from "@ant-design/icons";
import { SubDatabaseHint } from "../components/SubDatabaseHint";
import { ServerSettings } from "./ServerSettings";
import { isWebElectron } from "../../../finder/events/webEventTools";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { DbIncludedManager } from "./DbIncludedManager";
import { RefreshUi } from "./RefreshUi";

const Segments = {
  ...(isWebElectron
    ? {
        ServerSettings,
      }
    : {}),
  ScanPathManager,
  FileNameToExcludeManager,
  FileNameToExcludeChildrenManager,
  AbsolutePathToExcludeManager,
  DbIncludedManager,
  RemoteWfinderManager,
  ...(isWebElectron
    ? {
        RefreshUi,
      }
    : {}),
};

const SubDbSegments = {
  ScanPathManager,
  FileNameToExcludeManager,
  FileNameToExcludeChildrenManager,
  AbsolutePathToExcludeManager,
  DbIncludedManager,
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
