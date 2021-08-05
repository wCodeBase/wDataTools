import {
  CaretDownOutlined,
  ClearOutlined,
  FilterFilled,
  LoadingOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import { Input, Popover, Tooltip } from "antd";
import { debounce } from "lodash";
import React, { useEffect, useRef } from "react";
import { EvConsole, EvUiCmdMessage } from "../../../finder/events/events";
import { formatDate } from "../../../tools/tool";
import { useStableState, useSubjectCallback } from "wjstools";
import { defaultPropsFc } from "../../tools/fc";

type Output = {
  at: Date;
  from: "UiMessage" | "EvLog";
  message: string;
  type: "log" | "error" | "warn";
};

const OUTPUT_LIMIT = 10000;
const SHOW_DURATION = 5000;
const SHOW_LENGTH_STEP = 200;
const typeBgMap = {
  log: "bg-transparent",
  error: "bg-red-500",
  warn: "bg-orange-500",
};
const typeImportanceMap = {
  log: 0,
  warn: 1,
  error: 2,
};

export const ConsoleOutput = defaultPropsFc(
  { className: "" },
  (props) => {
    const [state, setState, update] = useStableState(() => ({
      outputs: [] as Output[],
      filteredOutputs: null as null | Output[],
      showShine: false,
      showLog: false,
      showLength: SHOW_LENGTH_STEP,
      errorCount: 0,
      warningCount: 0,
      lastImportOutput: null as null | Output,
      addNewOutput: (output: Output) => {
        if (!output.message) return;
        if (Date.now() - output.at.valueOf() > 5000) return;
        state.outputs.unshift(output);
        if (state.outputs.length > 1.2 * OUTPUT_LIMIT)
          state.outputs = state.outputs.slice(0, OUTPUT_LIMIT);
        state.showShine = true;
        if (output.type === "error") state.errorCount++;
        else if (output.type === "warn") state.warningCount++;
        const lastImportant =
          typeImportanceMap[state.lastImportOutput?.type || "log"];
        if (typeImportanceMap[output.type] >= lastImportant)
          state.lastImportOutput = output;
        update();
        state.hideOutput();
      },
      hideOutput: debounce(() => {
        setState({ showShine: false, lastImportOutput: null });
      }, SHOW_DURATION),
      showHideLog: () => {
        setState({
          showLog: !state.showLog,
          showLength: SHOW_LENGTH_STEP,
          showShine: false,
        });
      },
      showFilter: false,
      filterReg: "",
      showHideFilter: () => {
        setState({ showFilter: !state.showFilter });
      },
      setFilterReg: (ev: React.ChangeEvent<HTMLInputElement>) => {
        const filterReg = ev.target.value;
        const regExp = new RegExp(filterReg);
        setState({
          filterReg,
          filteredOutputs: filterReg
            ? state.outputs.filter((v) => regExp.test(v.message))
            : null,
        });
      },
      clearOutput: () => {
        setState({
          outputs: [],
          filteredOutputs: null,
          errorCount: 0,
          warningCount: 0,
          showLength: SHOW_LENGTH_STEP,
        });
      },
    }));

    const outputRootRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const listener = debounce(() => {
        const element = scrollRef.current;
        if (element && state.outputs.length > state.showLength) {
          if (
            element.scrollHeight - element.scrollTop - element.clientHeight <
            100
          ) {
            setState({ showLength: state.showLength + SHOW_LENGTH_STEP });
          }
        }
      }, 300);
      scrollRef.current?.addEventListener("scroll", listener);
      return () => scrollRef.current?.removeEventListener("scroll", listener);
    }, [state.showLog]);

    useSubjectCallback(EvUiCmdMessage, (msg) => {
      state.addNewOutput({ from: "UiMessage", ...msg });
    });

    useSubjectCallback(EvConsole, (log) => {
      if (!log) return;
      state.addNewOutput({ from: "EvLog", ...log });
    });

    return (
      <>
        <Tooltip placement="topLeft" title="Console output.">
          <div
            ref={outputRootRef}
            onClick={state.showHideLog}
            className={
              "relative mx-1 flex flex-row items-center flex-nowrap flex-shrink flex-grow truncate h-full cursor-pointer " +
              props.className
            }
          >
            {/* Footer output bar */}
            <span className="z-10 ml-1 text-base font-bold flex flex-row items-center">
              <ProfileOutlined className="mr-1" />
            </span>
            {/* Footer output background */}
            <div
              className={
                "absolute w-full h-full z-0 " +
                typeBgMap[state.lastImportOutput?.type || "log"] +
                (state.showLog
                  ? " bg-gradient-to-br from-coolGray-700 to-blueGray-600 "
                  : "") +
                (state.showShine ? " animate-shine" : "")
              }
            />
            {state.lastImportOutput && (
              <>
                {/* Footer latest output line */}
                <div className="flex-shrink truncate z-10 px-1">
                  {state.lastImportOutput.message}
                </div>
              </>
            )}
          </div>
        </Tooltip>

        {/* Console log history */}
        {state.showLog && (
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{ bottom: outputRootRef.current?.clientHeight || 0 }}
            className="cursor-default flex flex-col fixed bg-gradient-to-br from-coolGray-500 to-trueGray-600 w-vw1/1 h-vh1/3 max-h-64 left-0 -translate-x-full overflow-hidden z-10"
          >
            <div className="bg-gradient-to-br from-blueGray-700 to-blueGray-500 shadow-sm px-1 py-0.5 text-sm font-bold flex flex-row">
              <span>
                Console output history (Total: {state.outputs.length}
                {state.errorCount ? ` Error: ${state.errorCount}` : ""}
                {state.warningCount ? ` Warning: ${state.warningCount}` : ""}) :
              </span>
              <span className="flex-grow" />
              <Tooltip
                placement="topRight"
                title="Clear console output history,"
              >
                <span
                  onClick={state.clearOutput}
                  className="transform scale-125 flex flex-row items-center py-1 cursor-pointer mr-3 "
                >
                  <ClearOutlined />
                </span>
              </Tooltip>
              <Popover
                trigger="none"
                visible={state.showFilter}
                onVisibleChange={state.showHideFilter}
                content={
                  <div>
                    <Input
                      placeholder="Input filter regular expression here"
                      value={state.filterReg}
                      onChange={state.setFilterReg}
                    />
                  </div>
                }
                placement="bottomRight"
              >
                <Tooltip
                  title="Filter console output history"
                  placement="topRight"
                >
                  <span
                    onClick={state.showHideFilter}
                    className={
                      "transform scale-125 flex flex-row items-center py-1 cursor-pointer mr-3 " +
                      (state.filterReg ? "text-blue-400" : "")
                    }
                  >
                    <FilterFilled />
                  </span>
                </Tooltip>
              </Popover>
              <Tooltip title="Hide this pannel" placement="topRight">
                <span
                  onClick={state.showHideLog}
                  className="transform scale-125 flex flex-row items-center py-1 cursor-pointer"
                >
                  <CaretDownOutlined />
                </span>
              </Tooltip>
            </div>
            <div ref={scrollRef} className="p-2 flex-grow overflow-y-auto">
              {(state.filteredOutputs || state.outputs)
                .slice(0, state.showLength)
                .map((v, index) => {
                  return (
                    <div
                      key={index + "/" + v.at.valueOf}
                      className={
                        "px-1 my-0.5 flex flex-row " + typeBgMap[v.type]
                      }
                    >
                      <div className="font-bold mr-1 whitespace-nowrap">
                        {formatDate(v.at)}:
                      </div>
                      <div className="break-all whitespace-pre-wrap">
                        {v.message}
                      </div>
                    </div>
                  );
                })}
              {(state.filteredOutputs || state.outputs).length >
                state.showLength && (
                <div className="flex flex-row justify-center">
                  <LoadingOutlined />
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  },
  true
);
