import { Box, Text } from "ink";
import React, { useEffect, useMemo } from "react";
import SelectInput from "ink-select-input";
import { CmdInput } from "../components/CmdInput";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import {
  FinderStatus,
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
  useFinderStatus,
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
import { doInkExit } from "../exit";
import { Confirm } from "../components/Confirm";
import { FileType } from "../../../finder/types";
import { simpleGetKey } from "../../tools";
import { PathManager } from "./components/PathManager";
import {
  FileNameToExclude,
  FileNameToExcludeChildren,
} from "./components/TypedConfigLineManager";

const ellipsisText = (text: string, maxLength = 50) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
};

const Search = () => {
  const [finderStatus, subject] = useFinderStatus();
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

  useCliKeyPress((key) => {
    if (state.keywords && state.records?.length) {
      if (subject.value === FinderStatus.searching)
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
                <Text key={simpleGetKey(v)}>{`(${state.skip + i + 1}) ${
                  FileType[v.type]
                } ${ellipsisText(v.name)}`}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}
      {finderStatus === FinderStatus.idle && (
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
  const [finderStatus, subject] = useFinderStatus();
  const [state, setState] = useStableState(() => ({
    confirmed: finderStatus === FinderStatus.scanning,
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
      finderStatus === FinderStatus.scanning
        ? ["stop", "stop and goback"]
        : ["goback", "scan again"];
    return options.map((v) => ({ label: v, value: v }));
  }, [finderStatus]);

  useSubjectCallback(EvUiCmdMessage, (msg) =>
    setState({
      scanMessages: state.scanMessages.concat([
        { ...msg, number: state.scanMessages.length },
      ]),
    })
  );

  useCliEscape(() => {
    if (subject.value === FinderStatus.scanning) return true;
  });

  useEffect(() => {
    if (state.goingBack && finderStatus === FinderStatus.idle)
      triggerCliKeyCallback(KEY_ESCAPE);
  }, [finderStatus, state.goingBack]);

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
                  backgroundColor={"gray"}
                  color={msg.error ? "yellow" : "white"}
                >{`(${msg.number}) ${msg.message} ${msg.error || ""}`}</Text>
              ))
          )}
        </Box>
      }
      <Text>
        Usable options{" "}
        {finderStatus === FinderStatus.scanning
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

const CommandRenders: Record<string, React.FC | undefined> = {
  search: Search,
  scan: Scan,
  pathManage: PathManager,
  fileNameToExclude: FileNameToExclude,
  fileNameToExcludeChildren: FileNameToExcludeChildren,
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
