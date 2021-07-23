import React from "react";
import { Button, Empty, Input, message, Popover, Table, Tooltip } from "antd";
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
import { getLocalContext } from "../../../finder/events/webEvent";
import { useState } from "react";
import { showModal } from "../uiTools";
import prettyBytes from "pretty-bytes";
import { CaretRightFilled } from "@ant-design/icons";
import { format } from "d3-format";

const formatNumber = format(".0s");

const DetailButton = React.memo(
  (props: { record: TypeMsgSearchResultItem }) => {
    return (
      <Button
        size="small"
        type="primary"
        onClick={async () => {
          const { record } = props;
          const handle = showModal(() => ({
            footer: null,
            title: (
              <div>
                Details of <span className="font-bold">{record.name}</span>
              </div>
            ),
            render: () => (
              <div>
                <div className="pb-1">
                  <span className="text-sm font-bold">Absolute Path:</span>{" "}
                  {record.absPath}
                </div>
                <div className="pb-1">
                  <span className="text-sm font-bold">File type: </span>
                  {FileType[record.type]}
                </div>
                {record.type === FileType.file && (
                  <div className="pb-1">
                    <span className="text-sm font-bold">File size: </span>
                    {record.size}
                  </div>
                )}
                <div className="pb-1">
                  <span className="text-sm font-bold">
                    Stored in database:{" "}
                  </span>
                  {record.dbInfo.dbPath}
                </div>
                {props.record.dbInfo.remoteUrls && (
                  <div className="pb-1">
                    <div>
                      <span className="text-sm font-bold">
                        Remote context:{" "}
                      </span>
                      {props.record.dbInfo.remoteUrls.join(" >> ")}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-row-reverse">
                  <Button type="primary" onClick={() => handle.destory()}>
                    OK
                  </Button>
                </div>
              </div>
            ),
          }));
        }}
      >
        detail
      </Button>
    );
  }
);

const Columns: ColumnsType<TypeMsgSearchResultItem> = [
  {
    title: "name",
    key: "name",
    dataIndex: "name",
    render: (v) => <span className="whitespace-nowrap">{v}</span>,
  },
  {
    title: "type",
    key: "type",
    dataIndex: "type",
    render: (val) => FileType[val],
  },
  {
    title: "parent",
    key: "parent",
    dataIndex: "parent",
    render: (_, record) => {
      const parent = record.absPath?.slice(0, -record.name.length);
      return (
        <Tooltip title={parent}>
          <div className="break-all truncate text-rtl max-w-vw1/2 lg:max-w-vw1/4 ">
            {parent}
          </div>
        </Tooltip>
      );
    },
  },
  {
    title: "size",
    key: "size",
    dataIndex: "size",
    fixed: "right",
    render: (val) => (
      <span className="whitespace-nowrap">{prettyBytes(val)}</span>
    ),
  },
  {
    title: "operation",
    key: "operation",
    dataIndex: "operation",
    fixed: "right",
    render: (_, record) => {
      return <DetailButton record={record} />;
    },
  },
];
Columns.forEach((v) => (v.align = "center"));

export const Search = ({ className = "" }) => {
  const [finderStatus, subject] = useFinderStatus();
  const [state, setState] = useStableState(() => ({
    skip: 0,
    take: 5,
    total: 0,
    keywords: [] as string[],
    ftsInput: "",
    fullMatchInput: "",
    regMatchInput: "",
    searching: false,
    complexSearch: false,
    records: null as TypeMsgSearchResultItem[] | null,
    switchComplexSearch: () => {
      setState({ complexSearch: !state.complexSearch });
    },
    onSearch: () => {
      const str = state.ftsInput;
      if (finderStatus.status === FinderStatus.searching) {
        message.warning("Busy searching now, please retry later.");
      } else if (
        str ||
        (state.complexSearch && (state.fullMatchInput || state.regMatchInput))
      ) {
        setState({ skip: 0, keywords: [str] });
        state.doSearch();
      } else {
        message.warn("Input is empty!");
      }
    },

    doSearch: async () => {
      if (!EvFinderReady.value) {
        return;
      }
      setState({ searching: true });
      const { records, ...rest } = state;
      const res = await executeUiCmd("search", {
        cmd: "search",
        data: {
          ...rest,
          ...(state.complexSearch
            ? {}
            : { fullMatchInput: "", regMatchInput: "" }),
        },
        context: getLocalContext(),
      }).catch((e) => {
        message.error(String(e));
        return null;
      });
      if (res) {
        if (res.result.error) {
          message.error(res.result.error);
        } else {
          const { records, skip, total } = res.result;
          setState({ records, skip, total });
        }
      }
      setState({ searching: false });
    },
    adjusTakeNum: debounce(() => {
      const element = tableAreaRef.current;
      if (element) {
        setState({ take: Math.floor(element.clientHeight / 57) - 3 });
        if (state.records?.length) state.doSearch();
      }
    }, 300),
  }));

  useFinderReady(() => {
    setState({ skip: 0, total: 0, records: null, keywords: [] });
  });

  const tableAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tableAreaRef.current) {
      const obsever = new ResizeObserver(state.adjusTakeNum);
      obsever.observe(tableAreaRef.current);
      return () => {
        obsever.disconnect();
      };
    }
  }, []);

  return (
    <div className={"rounded-sm flex flex-col flex-grow " + className}>
      {/* Search input area. */}
      <div
        className={
          "flex flex-row rounded-sm bg-cyan-500 shadow-sm text-white transition-colors duration-300 " +
          (state.complexSearch ? "p-2  bg-opacity-20" : "bg-opacity-0")
        }
      >
        <div
          className="flex-shrink-0 flex flex-Row items-center cursor-pointer"
          onClick={state.switchComplexSearch}
        >
          <span className="flex flex-row items-center text-xl cursor-pointer">
            <CaretRightFilled
              className={
                "transform transition-transform duration-300 " +
                (state.complexSearch ? "rotate-90" : "")
              }
            />
          </span>
        </div>
        <div className="flex-grow mx-1">
          <div className="flex flex-row whitespace-nowrap items-center my-1">
            <div
              className={
                "mr-1 font-bold " + (state.complexSearch ? "" : "hidden")
              }
            >
              Keywords match:
            </div>
            <Input
              disabled={!EvFinderReady.value}
              allowClear
              placeholder="input search keywords"
              value={state.ftsInput}
              onChange={(ev) => setState({ ftsInput: ev.target.value })}
              onPressEnter={state.onSearch}
            />
          </div>
          <div
            className={
              "flex flex-row whitespace-nowrap items-center my-1 " +
              (state.complexSearch ? "" : "hidden")
            }
          >
            <span className="mr-1 font-bold">Full match:</span>
            <Input
              disabled={!EvFinderReady.value}
              allowClear
              placeholder="input full match text"
              value={state.fullMatchInput}
              onChange={(ev) => setState({ fullMatchInput: ev.target.value })}
              onPressEnter={state.onSearch}
            />
          </div>
          <div
            className={
              "flex flex-row whitespace-nowrap items-center my-1 " +
              (state.complexSearch ? "" : "hidden")
            }
          >
            <span className="mr-1 font-bold">Reg match:</span>
            <Input
              disabled={!EvFinderReady.value}
              allowClear
              placeholder="input regular expression"
              value={state.regMatchInput}
              onChange={(ev) => setState({ regMatchInput: ev.target.value })}
              onPressEnter={state.onSearch}
            />
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-row items-center">
          <Button
            type="primary"
            disabled={!EvFinderReady.value}
            loading={state.searching}
            onClick={state.onSearch}
          >
            Search
          </Button>
        </div>
      </div>

      {/* Search result area. */}
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
              showTotal: (total, range) => (
                <span>{`${range[0]}-${range[1]} of ${formatNumber(
                  total
                )}`}</span>
              ),
              showSizeChanger: false,
              onChange: (page) => {
                setState({ skip: (page - 1) * state.take });
                state.doSearch();
              },
              pageSize: state.take,
              current: Math.floor(state.skip / state.take) + 1,
            }}
            scroll={{ x: true }}
            dataSource={state.records}
            columns={Columns}
            rowKey={simpleGetKey}
          />
        )}
      </div>
    </div>
  );
};
