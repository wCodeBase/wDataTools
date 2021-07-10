import { defaultPropsFc } from "./../../tools/fc";
import React from "react";
import { ScanPathManager } from "./ScanPathManager";
import {
  FileNameToExcludeChildrenManager,
  FileNameToExcludeManager,
} from "./TypedConfigLineManager";

const segments = [
  ScanPathManager,
  FileNameToExcludeManager,
  FileNameToExcludeChildrenManager,
];

export const Setting = defaultPropsFc(
  { className: "" },
  (props) => {
    return (
      <div className={"flex flex-col shadow-sm h-full " + props.className}>
        <div className="text-white text-lg font-bold bg-lightBlue-500 rounded-sm p-0.5 px-2 ">
          Setting
        </div>
        <div className="h-2 flex-shrink-0" />
        <div className="overflow-auto">
          {segments.map((Render, index) => {
            return (
              <div
                key={Render.name}
                className={
                  "rounded-sm shadow-sm" +
                  (index < segments.length - 1 ? " mb-2 " : "")
                }
              >
                <Render titleClassName="text-white text-base leading-6 bg-lightBlue-800 p-1 " />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  true
);
