import { defaultPropsFc } from "./../../tools/fc";
import React from "react";
import { ScanPathManager } from "./ScanPathManager";
import {
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

const Segments = {
  ScanPathManager,
  FileNameToExcludeManager,
  FileNameToExcludeChildrenManager,
  RemoteWfinderManager,
};

const SubDbSegments = {
  ScanPathManager,
  FileNameToExcludeManager,
  FileNameToExcludeChildrenManager,
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
      <div className={"flex flex-col shadow-sm h-full " + props.className}>
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
                  <Render titleClassName="text-white text-base leading-6 bg-lightBlue-800 p-1 " />
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
