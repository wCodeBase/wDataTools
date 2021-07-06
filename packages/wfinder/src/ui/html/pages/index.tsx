import React from "react";
import { Body } from "../blocks/Body";
import { Footer } from "../blocks/Footer";
import { Header } from "../blocks/Header";

export const FinderUi = () => {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <Body className="flex-grow" />
      <Footer />
    </div>
  );
};
