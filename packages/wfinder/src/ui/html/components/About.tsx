import React from "react";
import { defaultPropsFc } from "../../tools/fc";

export const About = defaultPropsFc(
  {
    className: "",
    titleClassName: "",
  },
  (props) => {
    return (
      <div>
        <div className={props.titleClassName + " flex flex-row items-center"}>
          About
        </div>
        <div
          className={
            "flex flex-col items-center justify-center break-all text-center  font-bold p-4 bg-white shadow-sm " +
            props.className
          }
        >
          <div className="text-base">WFinder</div>
          <div>
            <span>Version: </span>
            <span>{require("../../../../package.json").version}</span>
          </div>
          <div>
            <span>Homepage: </span>
            <br />
            <a>{require("../../../../package.json").homepage}</a>
          </div>
        </div>
      </div>
    );
  },
  true
);
