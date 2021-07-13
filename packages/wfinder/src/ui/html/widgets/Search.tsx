import React from "react";
import { Empty, Input, message, Table } from "antd";
import "antd/lib/message/style/css";
import {
  EvFinderReady,
  EvUiCmd,
  EvUiCmdResult,
  useFinderStatus,
} from "../../../finder/events/events";
import {
  FinderStatus,
  TypeMsgSearchResultItem,
} from "../../../finder/events/types";
import { useStableState, useSubjectCallback } from "../../hooks/hooks";
import { ColumnsType } from "antd/lib/table";
import { FileType } from "../../../finder/types";
import { useRef } from "react";
import { useEffect } from "react";
import { debounce } from "lodash";
import { simpleGetKey } from "../../tools";
import { executeUiCmd } from "../../../finder/events/eventTools";
import { useFinderReady } from "../../hooks/webHooks";

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

export const Search = ({ className = "" }) => {
  const [finderStatus, subject] = useFinderStatus();
  const [state, setState] = useStableState(() => ({
    skip: 0,
    take: 5,
    total: 0,
    keywords: [] as string[],
    records: null as TypeMsgSearchResultItem[] | null,
    onSubmit: (str: string) => {
      if (finderStatus === FinderStatus.searching) {
        message.warning("Busy searching now, please retry later.");
      } else if (str) {
        setState({ skip: 0, keywords: [str] });
        state.doSearch();
      } else {
        message.warn("Keyword input is empty!");
      }
    },

    doSearch: async () => {
      if (!EvFinderReady.value) return;
      if (state.keywords.every((v) => v)) {
        const res = await executeUiCmd("search", {
          cmd: "search",
          data: { ...state },
        }).catch((e) => {
          message.error(String(e));
          return null;
        });
        if (res) {
          const { records, skip, total } = res.result;
          setState({ records, skip, total });
        }
      }
    },
    adjusTakeNum: debounce(() => {
      const element = tableAreaRef.current;
      if (element) {
        setState({ take: Math.floor(element.clientHeight / 55) - 3 });
        state.doSearch();
      }
    }, 300),
  }));

  useFinderReady(() => {
    setState({ skip: 0, total: 0, records: null, keywords: [] });
  });

  const tableAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    state.adjusTakeNum();
    window.addEventListener("resize", state.adjusTakeNum);
    return () => window.removeEventListener("resize", state.adjusTakeNum);
  }, []);

  return (
    <div className={"rounded-sm flex flex-col flex-grow " + className}>
      <Input.Search
        disabled={!EvFinderReady.value}
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
            rowKey={simpleGetKey}
          />
        )}
      </div>
    </div>
  );
};
