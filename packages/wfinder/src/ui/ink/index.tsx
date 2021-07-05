import React from "react";
import { Header } from "./blocks/Header";
import { Body } from "./blocks/Body";
import { InkConsole } from "./blocks/Console";
import { exitCallbacks } from "./exit";
import { EvUiLaunched } from "../../finder/events/events";
import { render } from "ink";

export const Ui = () => {
  return (
    <>
      <Header />
      <InkConsole />
      <Body />
    </>
  );
};

export const renderInkUi = () => {
  EvUiLaunched.next({ ink: true });
  const handler = render(<Ui />);
  exitCallbacks.push(async () => {
    handler.clear();
    EvUiLaunched.next({ ink: false });
  });
  return handler;
};
