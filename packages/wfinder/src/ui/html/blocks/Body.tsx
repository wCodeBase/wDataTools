import React from "react";
import { defaultPropsFc } from "../../tools/fc";
import { Search } from "../widgets/Search";
import { Setting } from "../widgets/Setting";

export const Body = defaultPropsFc({ className: "" }, (props) => {
  return (
    <div
      className={
        props.className +
        " overflow-auto bg-gradient-to-tr from-cyan-700 to-lightBlue-700 flex"
      }
    >
      <Search className="my-2 mx-3 p-1" />
      <div className="sm:hidden lg:block w-2/5 py-3 pr-4 h-full ">
        <Setting className="h-full" />
      </div>
    </div>
  );
});
