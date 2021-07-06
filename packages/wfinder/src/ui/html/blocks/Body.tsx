import React from "react";
import { defaultPropsFc } from "../../tools/fc";
import { Search } from "../widgets/Search";

export const Body = defaultPropsFc({ className: "" }, (props) => {
  return (
    <div
      className={
        props.className +
        " overflow-auto bg-gradient-to-tr from-cyan-700 to-lightBlue-700 flex"
      }
    >
      <Search />
    </div>
  );
});
