import { Box, Text } from "ink";
import React, { useEffect, useMemo } from "react";
import { CmdInput } from "../../components/CmdInput";
import { useStableState, useSubjectCallback } from "../../../hooks/hooks";
import {
  TypeMsgConfigItem,
  TypeMsgPathItem,
} from "../../../../finder/events/types";
import {
  EvLog,
  EvLogError,
  EvUiCmd,
  EvUiCmdResult,
} from "../../../../finder/events/events";
import {
  KEY_ARROW_DOWN,
  KEY_ARROW_UP,
  KEY_ESCAPE,
  KEY_PAGE_DOWN,
  KEY_PAGE_UP,
  useCliEscape,
  useCliKeyPress,
} from "../../../ink/consoleHooks/useCliKeyPress";
import { Confirm } from "../../components/Confirm";
import { HorizontalSelect } from "../../components/HorizontalSelect";
import { simpleGetKey } from "../../../tools";
import { ConfigLineType } from "../../../../finder/types";

export const genConfigLineManager = (type: ConfigLineType) => () => {
  const [state, setState] = useStableState(() => ({
    cmd: "",
    waitingForCmdResult: false,
    configs: [] as TypeMsgConfigItem[],
    selectedId: -1,
    showLength: 5,
    skip: 0,
    newConfig: "",
    checkBusy: () => {
      if (state.waitingForCmdResult) EvLog("Busy now, pleace waiting...");
      return state.waitingForCmdResult;
    },
    onSelect: (value: string) => {
      if (state.checkBusy()) return;
      setState({ cmd: value });
    },
  }));

  const cmdOptions = useMemo(
    () =>
      [
        ...(state.configs.find((v) => v.id === state.selectedId)
          ? ["delete highlight record"]
          : []),
        "add new record",
      ].map((v) => ({ label: v, value: v })),
    [state.configs, state.selectedId]
  );

  useSubjectCallback(EvUiCmdResult, (msg) => {
    if (msg.cmd === "deleteConfig" || msg.cmd === "addConfig") {
      if (msg.result.error) {
        EvLogError("Error: " + msg.result.error);
        setState({ waitingForCmdResult: false });
      } else {
        EvUiCmd.next({ cmd: "listConfig", data: { type } });
        setState({ newConfig: "" });
      }
    } else if (msg.cmd === "listConfig") {
      setState({
        configs: msg.result.results,
        skip: Math.max(
          0,
          Math.min(state.skip, msg.result.results.length - state.showLength)
        ),
      });
      if (msg.result.error) EvLogError("Error: " + msg.result.error);
      if (state.waitingForCmdResult)
        setState({ waitingForCmdResult: false, cmd: "" });
    }
  });

  useEffect(() => {
    EvUiCmd.next({ cmd: "listConfig", data: { type } });
  }, []);

  useCliEscape(() => {
    if (state.waitingForCmdResult) return true;
    if (state.cmd) {
      setState({ cmd: "" });
      return true;
    }
  });

  useCliKeyPress((key) => {
    if (
      key === KEY_ARROW_UP ||
      key === KEY_ARROW_DOWN ||
      key === KEY_PAGE_UP ||
      key === KEY_PAGE_DOWN
    ) {
      if (state.cmd === "") {
        let currentIndex = -1;
        let skip = state.skip;
        const viewEnd =
          Math.min(skip + state.showLength, state.configs.length) - 1;
        if (key === KEY_ARROW_UP || key === KEY_ARROW_DOWN) {
          currentIndex = state.configs.findIndex(
            (v) => v.id === state.selectedId
          );
          if (currentIndex < skip || currentIndex > viewEnd) {
            currentIndex = key === KEY_ARROW_UP ? viewEnd : skip;
          } else {
            if (key === KEY_ARROW_UP) {
              currentIndex--;
              if (currentIndex < skip) skip--;
            } else {
              currentIndex++;
              if (currentIndex > viewEnd) skip++;
            }
            if (currentIndex < 0 || currentIndex > state.configs.length - 1) {
              EvLog("Bound is reached");
              return;
            }
          }
        } else {
          if (key === KEY_PAGE_UP) {
            skip = Math.max(0, skip - state.showLength);
          } else {
            skip = Math.min(
              state.configs.length - state.showLength,
              skip + state.showLength
            );
          }
        }
        const selectedId = state.configs[currentIndex]?.id || -1;
        setState({ selectedId, skip });
      }
      return true;
    }
  });

  return (
    <>
      <Box display="flex" flexDirection="column" marginBottom={1}>
        <Text color="blue">
          Scan path list (total {`${state.configs.length}`}):
        </Text>
        {!state.configs.length ? (
          <Text>No scan path exist yet.</Text>
        ) : (
          state.configs
            .slice(state.skip, state.skip + state.showLength)
            .map((v, i) => (
              <Text
                key={simpleGetKey(v)}
                backgroundColor={v.id === state.selectedId ? "blue" : ""}
              >{`(${state.skip + i + 1}) ${v.content}`}</Text>
            ))
        )}
      </Box>

      {!state.cmd ? (
        <>
          <HorizontalSelect<string>
            label="Usable options:"
            onSelect={state.onSelect}
            autoSelectFirstOption
            options={cmdOptions}
          />
        </>
      ) : state.cmd.includes("delete") ? (
        <Confirm
          danger
          horizontal
          message={`Sure to delete record: ${
            state.configs.find((v) => v.id === state.selectedId)?.content
          }`}
          onSelect={(confirm) => {
            if (state.checkBusy()) return;
            const config = state.configs.find((v) => v.id === state.selectedId);
            if (confirm && config) {
              EvUiCmd.next({
                cmd: "deleteConfig",
                data: config,
              });
              setState({ waitingForCmdResult: true });
            } else setState({ cmd: "" });
          }}
        />
      ) : (
        state.cmd.includes("new") && (
          <>
            {!state.newConfig ? (
              <CmdInput
                initialValue={state.newConfig}
                label="New record"
                placeholder="Input new record here"
                onSubmit={(newPath) => setState({ newConfig: newPath })}
              />
            ) : (
              <Confirm
                horizontal
                message={`Add this record?: ${state.newConfig}`}
                onSelect={(confirm) => {
                  if (confirm) {
                    EvUiCmd.next({
                      cmd: "addConfig",
                      data: [{ content: state.newConfig, type }],
                    });
                    setState({ waitingForCmdResult: true });
                  } else {
                    setState({ newConfig: "" });
                  }
                }}
              />
            )}
          </>
        )
      )}
    </>
  );
};

export const FileNameToExclude = genConfigLineManager(
  ConfigLineType.excludeFileName
);
export const FileNameToExcludeChildren = genConfigLineManager(
  ConfigLineType.excludeChildrenFolderName
);
