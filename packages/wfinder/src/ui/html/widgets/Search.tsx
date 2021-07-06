import React from "react";
import { Empty, Input, message, Table } from "antd";
import "antd/lib/message/style/css";
import {
  EvUiCmd,
  EvUiCmdResult,
  useFinderState,
} from "../../../finder/events/events";
import {
  FinderState,
  TypeMsgSearchResultItem,
} from "../../../finder/events/types";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { ColumnsType } from "antd/lib/table";
import { FileType } from "../../../finder/types";
import { useRef } from "react";
import { useEffect } from "react";
import { debounce } from "lodash";

const Columns: ColumnsType<TypeMsgSearchResultItem> = [
  { title: "name", key: "name", dataIndex: "name" },
  {
    title: "type",
    key: "type",
    dataIndex: "type",
    render: (val) => FileType[val],
  },
  { title: "size", key: "size", dataIndex: "size" },
];

export const Search = () => {
  const [finderState, subject] = useFinderState();
  const [state, setState] = useStableState(() => ({
    skip: 0,
    take: 5,
    total: 0,
    keywords: [] as string[],
    records: null as TypeMsgSearchResultItem[] | null,
    onSubmit: (str: string) => {
      if (finderState === FinderState.searching) {
        message.warning("Busy searching now, please retry later.");
      } else if (str) {
        setState({ skip: 0, keywords: [str] });
        state.doSearch();
      } else {
        message.warn("Keyword input is empty!");
      }
    },
    doSearch: () => {
      if (state.keywords.every((v) => v))
        EvUiCmd.next({ cmd: "search", data: { ...state } });
    },
    adjusTakeNum: debounce(() => {
      const element = tableAreaRef.current;
      if (element) {
        setState({ take: Math.floor(element.clientHeight / 55) - 3 });
        state.doSearch();
      }
    }, 300),
  }));

  const tableAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    state.adjusTakeNum();
    window.addEventListener("resize", state.adjusTakeNum);
    return () => window.removeEventListener("resize", state.adjusTakeNum);
  }, []);

  useSubjectCallback(EvUiCmdResult, (msg) => {
    if (msg.cmd === "search") {
      const { records, skip, total } = msg.result;
      setState({ records, skip, total });
    }
  });

  return (
    <div className="rounded-sm my-2 mx-3 p-1 flex flex-col flex-grow">
      <Input.Search
        allowClear
        placeholder="input search keywords"
        enterButton="Search"
        onSearch={state.onSubmit}
      />
      <div
        ref={tableAreaRef}
        className="overflow-auto mt-2 flex-grow p-1 rounded-sm shadow-sm bg-white flex justify-center items-center"
      >
        {!state.records?.length ? (
          <Empty />
        ) : (
          <Table
            className="w-full h-full"
            pagination={{
              position: ["topCenter"],
              total: state.total,
              showSizeChanger: false,
              onChange: (page) => {
                setState({ skip: (page - 1) * state.take });
                state.doSearch();
              },
              pageSize: state.take,
              current: Math.floor(state.skip / state.take) + 1,
            }}
            dataSource={state.records}
            columns={Columns}
            rowKey={(v) => v.id + v.dbRoot}
          />
        )}
      </div>
    </div>
  );
};
