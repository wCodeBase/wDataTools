import { hot } from "react-hot-loader/root";
import ReactDOM from "react-dom";
import React from "react";
import { FinderUi } from "./pages";
import "./index.css";
import "./tailwind.css";
import "antd/dist/antd.css";

const Root = hot(() => <FinderUi />);

ReactDOM.render(<Root />, document.getElementById("react-root"));

// @ts-ignore
if (module.hot) {
  // @ts-ignore
  module.hot.accept("./pages");
}
