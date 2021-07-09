import { defaultPropsFc } from "./../../tools/fc";
import React from "react";
import { ScanPathManager } from "./ScanPathManager";

const segments = [ScanPathManager];

export const Setting = defaultPropsFc(
  { className: "" },
  (props) => {
    return (
      <div className={"flex flex-col shadow-sm" + props.className}>
        <div className="text-white text-lg font-bold bg-lightBlue-500 rounded-sm p-0.5 px-2 ">
          Setting
        </div>
        <div className="h-2" />
        <div className="overflow-auto">
          {segments.map((Render) => {
            return (
              <div key={Render.name} className="mb-2 rounded-sm shadow-sm">
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
