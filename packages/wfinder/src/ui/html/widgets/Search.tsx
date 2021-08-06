import { CaretRightFilled, LoadingOutlined } from "@ant-design/icons";
import { Button, Empty, Input, message, Table, Tooltip } from "antd";
import "antd/lib/message/style/css";
import { ColumnsType } from "antd/lib/table";
import { format } from "d3-format";
import { debounce } from "lodash";
import prettyBytes from "pretty-bytes";
import React, { useEffect, useRef } from "react";
import { EvFinderReady, useFinderStatus } from "../../../finder/events/events";
import { executeUiCmd } from "../../../finder/events/eventTools";
import {
  FinderStatus,
  TypeMsgSearchResultItem,
} from "../../../finder/events/types";
import {
  getLocalContext,
  getLocalRootContext,
  wEvFinderReady,
  wEvGlobalState,
} from "../../../finder/events/webEvent";
import { FileType } from "../../../finder/types";
import { showModal, useBehaviorSubjectValue, useStableState } from "wjstools";
import { useWindowSize } from "wjstools";
import { simpleGetKey } from "../../tools";
import { defaultPropsFc } from "../../tools/fc";
import { messageError } from "../uiTools";
import { useFinderReady } from "../../hooks/webHooks";

const _formatNumber = format(".3s");
const formatNumber = (num: number) => {
  if (!num) return num;
  if (num < 9999) return num;
  return _formatNumber(num);
};

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
  const [finderStatus] = useFinderStatus();
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
    records: undefined as TypeMsgSearchResultItem[] | undefined,
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
      const res = await messageError(
        executeUiCmd("search", {
          cmd: "search",
          data: {
            ...rest,
            ...(state.complexSearch
              ? {}
              : { fullMatchInput: "", regMatchInput: "" }),
          },
          context: getLocalContext(),
        })
      );
      if (res) {
        const { records, skip, total } = res.result;
        setState({ records, skip, total });
      }
      setState({ searching: false });
    },
    adjusTakeNum: debounce(() => {
      const element = tableAreaRef.current;
      if (element) {
        const take = Math.floor(element.clientHeight / 57) - 3;
        if (take === state.take) return;
        setState({ take });
        if (state.records?.length && state.skip > 0) state.doSearch();
      }
    }, 300),
  }));

  useFinderReady(() => {
    setState({ skip: 0, total: 0, records: undefined, keywords: [] });
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

  const windowSize = useWindowSize();

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
              Keywords<span className="hidden sm:visible"> match</span>:
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
            {!state.complexSearch || windowSize.width > 400 ? "Search" : "Go"}
          </Button>
        </div>
      </div>

      {/* Search result area. */}
      <div
        ref={tableAreaRef}
        className="overflow-auto mt-2 flex-grow p-1 rounded-sm shadow-sm bg-white flex justify-center items-center"
      >
        {!state.records ? (
          <FinderStateInfo searching={state.searching} />
        ) : !state.records.length && !state.skip ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Result" />
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

const FinderStateInfo = defaultPropsFc(
  { className: "", searching: false },
  (props) => {
    const [ready] = useBehaviorSubjectValue(wEvFinderReady);
    const [globalState] = useBehaviorSubjectValue(wEvGlobalState);
    if (!ready || props.searching)
      return (
        <div
          className={
            "flex flex-row items-center text-lg font-bold text-gray-600 " +
            (props.className || "")
          }
        >
          {!ready ? "Preparing wfinder" : "Searching"}{" "}
          <LoadingOutlined className="ml-2" />
        </div>
      );

    const context = getLocalContext();
    const rootContext = getLocalRootContext();
    return (
      <div
        className={
          "flex flex-col items-center justify-center text-center break-all text-base text-gray-600 p-6 " +
          (props.className || "")
        }
      >
        <div className="text-lg">Current wfinder infos:</div>
        <div className="my-3">
          <span>File count: </span>
          <br />
          {globalState.totalLoading ? (
            <LoadingOutlined />
          ) : (
            <>
              {!!globalState.remoteTotal && (
                <span>
                  local {globalState.localTotal}, remote{" "}
                  {globalState.remoteTotal},{" "}
                </span>
              )}
              <span>total {globalState.total}</span>
            </>
          )}
        </div>
        <div>
          <span>Current path: </span>
          <br />
          {rootContext?.remoteUrls?.length && (
            <span className="text-amber-400 font-bold">
              {rootContext.remoteUrls.join(" >> ") + " >> "}
            </span>
          )}
          <span>{context?.finderRoot}</span>
        </div>
        <div></div>
      </div>
    );
  },
  true
);
