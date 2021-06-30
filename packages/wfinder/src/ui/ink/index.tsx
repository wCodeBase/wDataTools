import React from "react";
import { Header } from "./blocks/Header";
import { Body } from "./blocks/Body";
import { InkConsole } from "./blocks/Console";
import { exitCallbacks } from "./exit";
import { EvUiStatus } from "../../finder/events/events";

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
  EvUiStatus.next({ ink: true });
  const handler = render(<Ui />);
  exitCallbacks.push(async () => {
    handler.clear();
    EvUiStatus.next({ ink: false });
  });
  return handler;
};
