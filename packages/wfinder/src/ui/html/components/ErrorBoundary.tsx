import React, { ErrorInfo } from "react";
import { PureComponent } from "react";
import { EvLog, EvLogError } from "../../../finder/events/events";

export class ErrorBoundary extends PureComponent<{ errorTitle?: string }> {
  state = {
    error: undefined as Error | undefined,
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-3 flex flex-col items-center bg-red-400 ">
        {this.props.errorTitle && (
          <div className="text-ba font-bold">{this.props.errorTitle}</div>
        )}
        <div className="text-lg font-bold">Failed to render UI here</div>
        <div className="text-center">{String(this.state.error)}</div>
      </div>
    );
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error });
    console.error("ErrorBoundary error caught: ", error, info);
    EvLogError("ErrorBoundary error caught: ", error);
  }
}
