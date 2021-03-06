import { Box, Text } from "ink";
import React, { useEffect, useMemo } from "react";
import { CmdInput } from "../../components/CmdInput";
import { useStableState, useSubjectCallback } from "../../../hooks/hooks";
import { TypeMsgPathItem } from "../../../../finder/events/types";
import {
  EvLog,
  EvLogError,
  EvUiCmd,
  EvUiCmdResult,
} from "../../../../finder/events/events";
import {
  KEY_ARROW_DOWN,
  KEY_ARROW_UP,
  KEY_PAGE_DOWN,
  KEY_PAGE_UP,
  useCliEscape,
  useCliKeyPress,
} from "../../../ink/consoleHooks/useCliKeyPress";
import { Confirm } from "../../components/Confirm";
import { HorizontalSelect } from "../../components/HorizontalSelect";
import { simpleGetKey } from "../../../tools";

export const PathManager = () => {
  const [state, setState] = useStableState(() => ({
    cmd: "",
    waitingForCmdResult: false,
    paths: [] as TypeMsgPathItem[],
    selectedId: -1,
    showLength: 5,
    skip: 0,
    newPath: "",
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
        ...(state.paths.find((v) => v.id === state.selectedId)
          ? ["delete highlight path"]
          : []),
        "add new path",
      ].map((v) => ({ label: v, value: v })),
    [state.paths, state.selectedId]
  );

  useSubjectCallback(EvUiCmdResult, (msg) => {
    if (msg.cmd === "deletePath" || msg.cmd === "addPath") {
      if (msg.result.error) {
        EvLogError("Error: " + msg.result.error);
        setState({ waitingForCmdResult: false });
      } else {
        EvUiCmd.next({ cmd: "listPath", data: [] });
        setState({ newPath: "" });
      }
    } else if (msg.cmd === "listPath") {
      setState({
        paths: msg.result.results,
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
    EvUiCmd.next({ cmd: "listPath", data: [] });
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
          Math.min(skip + state.showLength, state.paths.length) - 1;
        if (key === KEY_ARROW_UP || key === KEY_ARROW_DOWN) {
          currentIndex = state.paths.findIndex(
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
            if (currentIndex < 0 || currentIndex > state.paths.length - 1) {
              EvLog("Bound is reached");
              return;
            }
          }
        } else {
          if (key === KEY_PAGE_UP) {
            skip = Math.max(0, skip - state.showLength);
          } else {
            skip = Math.min(
              state.paths.length - state.showLength,
              skip + state.showLength
            );
          }
        }
        const selectedId = state.paths[currentIndex]?.id || -1;
        setState({ selectedId, skip });
      }
      return true;
    }
  });

  return (
    <>
      <Box display="flex" flexDirection="column" marginBottom={1}>
        <Text color="blue">
          Scan path list (total {`${state.paths.length}`}):
        </Text>
        {!state.paths.length ? (
          <Text>No scan path exist yet.</Text>
        ) : (
          state.paths
            .slice(state.skip, state.skip + state.showLength)
            .map((v, i) => (
              <Text
                key={simpleGetKey(v)}
                backgroundColor={v.id === state.selectedId ? "blue" : ""}
              >{`(${state.skip + i + 1}) ${v.path}`}</Text>
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
          message={`Sure to delete path: ${
            state.paths.find((v) => v.id === state.selectedId)?.path
          }`}
          onSelect={(confirm) => {
            if (state.checkBusy()) return;
            if (confirm) {
              EvUiCmd.next({
                cmd: "deletePath",
                data: [
                  state.paths.find((v) => v.id === state.selectedId)?.path ||
                    "",
                ],
              });
              setState({ waitingForCmdResult: true });
            } else setState({ cmd: "" });
          }}
        />
      ) : (
        state.cmd.includes("new") && (
          <>
            {!state.newPath ? (
              <CmdInput
                initialValue={state.newPath}
                label="New path"
                placeholder="Input new path here"
                onSubmit={(newPath) => setState({ newPath })}
              />
            ) : (
              <Confirm
                horizontal
                message={`Add this path?: ${state.newPath}`}
                onSelect={(confirm) => {
                  if (confirm) {
                    EvUiCmd.next({ cmd: "addPath", data: [state.newPath] });
                    setState({ waitingForCmdResult: true });
                  } else {
                    setState({ newPath: "" });
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
