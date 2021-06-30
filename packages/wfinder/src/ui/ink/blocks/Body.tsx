import { Box, Text } from "ink";
import React, { useEffect, useMemo } from "react";
import SelectInput from "ink-select-input";
import { CmdInput } from "../components/CmdInput";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import {
  FinderState,
  TypeMsgPathItem,
  TypeMsgSearchResultItem,
  TypeUiCmd,
  TypeUiMsgMessage,
  UI_CMD_DEF,
} from "../../../finder/events/types";
import {
  EvLog,
  EvUiCmd,
  EvUiCmdResult,
  EvUiCmdMessage,
  useFinderState,
} from "../../../finder/events/events";
import {
  KEY_ARROW_DOWN,
  KEY_ARROW_UP,
  KEY_ESCAPE,
  KEY_PAGE_DOWN,
  KEY_PAGE_UP,
  triggerCliKeyCallback,
  useCliEscape,
  useCliKeyPress,
} from "../../ink/consoleHooks/useCliKeyPress";
import { FileType } from "../../../finder/entities/FileInfo";
import { doInkExit } from "../exit";
import { Confirm } from "../components/Confirm";
import { HorizontalSelect } from "../components/HorizontalSelect";

const ellipsisText = (text: string, maxLength = 50) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
};

const Search = () => {
  const [finderState, subject] = useFinderState();
  const [state, setState] = useStableState(() => ({
    skip: 0,
    take: 5,
    total: 0,
    keywords: [] as string[],
    records: null as TypeMsgSearchResultItem[] | null,
    onSubmit: (str: string) => {
      if (str) {
        setState({ skip: 0, keywords: [str] });
        state.doSearch();
      } else EvLog("Error: keyword input is empty.");
    },
    doSearch: () => {
      if (state.keywords.every((v) => v))
        EvUiCmd.next({ cmd: "search", data: { ...state } });
    },
  }));

  useSubjectCallback(EvUiCmdResult, (msg) => {
    if (msg.cmd === "search") {
      const { records, skip, total } = msg.result;
      setState({ records, skip, total });
    }
  });

  useCliEscape(() => {
    if (state.records) {
      setState({ records: null });
      return true;
    }
  });

  useCliKeyPress((key) => {
    if (state.keywords && state.records?.length) {
      if (subject.value === FinderState.searching)
        EvLog("Busy searching now, try page up or down later.");
      else if (key === KEY_ARROW_UP) {
        if (state.skip) {
          setState({ skip: Math.max(state.skip - state.take, 0) });
          state.doSearch();
        } else EvLog("Can not page up, bound is reached");
      } else if (key === KEY_ARROW_DOWN) {
        if (state.skip + state.take < state.total) {
          setState({
            skip: Math.min(state.skip + state.take, state.total - state.take),
          });
          state.doSearch();
        } else EvLog("Can not page down, bound is reached");
      }
      return true;
    }
  });
  return (
    <Box display="flex" flexDirection="column">
      {!!state.records && (
        <Box>
          {!state.records.length ? (
            <Text color="yellow">No record matchs search keywords.</Text>
          ) : (
            <Box display="flex" flexDirection="column">
              <Text color="cyan">{`Result list (totoal ${state.total}, use arrow keys to switch page.):`}</Text>
              {state.records.map((v, i) => (
                <Text key={v.id + v.dbRoot}>{`(${state.skip + i + 1}) ${
                  FileType[v.type]
                } ${ellipsisText(v.name)}`}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}
      {finderState === FinderState.idle && (
        <CmdInput
          label="search"
          placeholder="Type keywords here"
          onSubmit={state.onSubmit}
        />
      )}
    </Box>
  );
};

const Scan = () => {
  const [finderState, subject] = useFinderState();
  const [state, setState] = useStableState(() => ({
    confirmed: finderState === FinderState.scanning,
    goingBack: false,
    scanMessages: [] as (TypeUiMsgMessage & { number: number })[],
    scanMsgShowLines: 5,
    onSelect: (option: { value: string }) => {
      if (state.goingBack) return;
      if (option.value.includes("goback")) setState({ goingBack: true });
      if (option.value.includes("stop"))
        EvUiCmd.next({ cmd: "stopScan", data: null });
      if (option.value.includes("scan again"))
        EvUiCmd.next({ cmd: "scan", data: null });
    },
  }));
  const items = useMemo(() => {
    const options =
      finderState === FinderState.scanning
        ? ["stop", "stop and goback"]
        : ["goback", "scan again"];
    return options.map((v) => ({ label: v, value: v }));
  }, [finderState]);

  useSubjectCallback(EvUiCmdMessage, (msg) =>
    setState({
      scanMessages: state.scanMessages.concat([
        { ...msg, number: state.scanMessages.length },
      ]),
    })
  );

  useCliEscape(() => {
    if (subject.value === FinderState.scanning) return true;
  });

  useEffect(() => {
    if (state.goingBack && finderState === FinderState.idle)
      triggerCliKeyCallback(KEY_ESCAPE);
  }, [finderState, state.goingBack]);

  if (!state.confirmed)
    return (
      <Confirm
        horizontal
        message="Start scanning?"
        onSelect={(confim) => {
          if (confim) {
            EvUiCmd.next({ cmd: "scan", data: null });
            setState({ confirmed: true });
          } else triggerCliKeyCallback(KEY_ESCAPE);
        }}
      />
    );

  return (
    <>
      {
        <Box marginBottom={1} display="flex" flexDirection="column">
          <Text color="cyan">Scan output messages:</Text>
          {!state.scanMessages.length ? (
            <Text>No message output yet.</Text>
          ) : (
            state.scanMessages
              .slice(-state.scanMsgShowLines)
              .map((msg) => (
                <Text
                  key={msg.number}
                  color={msg.error ? "yellow" : "white"}
                >{`(${msg.number}) ${msg.message} ${msg.error || ""}`}</Text>
              ))
          )}
        </Box>
      }
      <Text>
        Usable options{" "}
        {finderState === FinderState.scanning
          ? "(scaning)"
          : state.confirmed
          ? "(scan done)"
          : ""}
        :
      </Text>
      <SelectInput items={items} onSelect={state.onSelect} />
    </>
  );
};

const PathManage = () => {
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
        EvLog("Error: " + msg.result.error);
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
      if (msg.result.error) EvLog("Error: " + msg.result.error);
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
                key={v.path + v.dbRoot}
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

const CommandRenders: Record<string, React.FC | undefined> = {
  search: Search,
  scan: Scan,
  pathManage: PathManage,
  exit: () => <></>,
};

const Commands = (props: { onSelect: (cmd: TypeUiCmd) => void }) => {
  return (
    <>
      <Text>Choose what to do:</Text>
      <SelectInput
        // @ts-ignore
        onSelect={(item) => props.onSelect(item.value)}
        items={Object.entries(UI_CMD_DEF).map(([value, label]) => ({
          value,
          label,
        }))}
      />
    </>
  );
};

export const Body = () => {
  const [state, setState] = useStableState(() => ({ cmd: "" }));

  useCliEscape(() => {
    if (state.cmd) {
      setState({ cmd: "" });
      return true;
    }
  });

  useEffect(() => {
    if (state.cmd === "exit") doInkExit();
  }, [state.cmd]);

  if (!state.cmd) return <Commands onSelect={(cmd) => setState({ cmd })} />;
  const Render = CommandRenders[state.cmd];
  if (Render) return <Render />;
  return (
    <Text>{`ERROR: render for command "${state.cmd}" is not found.`}</Text>
  );
};
