import { message, Popover, Tooltip } from "antd";
import { isEqual, last } from "lodash";
import React from "react";
import { useMemo } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { EvFinderState } from "../../../finder/events/events";
import {
  WebContext,
  WebEventStatus,
  wEvEventStatus,
  wEvFinderReady,
  wEvGlobalState,
  wEvLocalDbContextChange,
} from "../../../finder/events/webEvent";
import { webInitEvent } from "../../../finder/events/webEventTools";
import {
  getDbInfoId,
  getLocalDbInfoStackId,
  TypeDbInfo,
} from "../../../finder/types";
import { usePickBehaviorSubjectValue } from "../../hooks/hooks";
import { SubDatabaseHint } from "../components/SubDatabaseHint";

const switchContext = async (
  context: WebContext,
  fromContext: WebContext,
  isNew: boolean,
  isRestore = false
) => {
  const { remoteUrls } = context;
  const { contextStack } = wEvGlobalState.value;
  const contextPos = contextStack.findIndex((v) => v === fromContext);
  const isCurrentContext = contextPos === contextStack.length - 1;
  const newContexts = contextStack.slice(0, contextPos + (isNew ? 1 : 0));
  newContexts.push(context);
  const msg = isRestore
    ? "Refresh to last context"
    : isCurrentContext
    ? "Refresh current context"
    : "Switch database context";
  try {
    EvFinderState.value.config = undefined;
    wEvFinderReady.next(false);
    if (!remoteUrls) {
      await webInitEvent(undefined, true);
    } else {
      wEvGlobalState.next({ contextStack: newContexts });
      const res = await webInitEvent(remoteUrls, true);
      if (!context.localContexts.length) context.localContexts = [res];
    }
    wEvGlobalState.next({ contextStack: newContexts });
    if (isRestore) message.warn(msg + " success");
    else message.success(msg + " success");
  } catch (e) {
    message.error(`${msg} failed: ${e}`);
    const contextToRestore = last(contextStack);
    if (contextToRestore) {
      wEvGlobalState.next({ contextStack });
      switchContext(contextToRestore, contextToRestore, false, true);
    }
  }
};

export const ContextPannel = React.memo(() => {
  const [contexts] = usePickBehaviorSubjectValue(
    wEvGlobalState,
    (v) => v.contextStack
  );

  return (
    <div className="w-vw9/10 max-w-3xl mhvh4/5 flex flex-col break-all">
      <div className="text-lg font-bold p-2 pb-0">Database context</div>
      <div className="flex-grow overflow-y-auto p-2">
        {contexts.map((context, index) => {
          return (
            <div
              key={
                getLocalDbInfoStackId(context.localContexts) +
                context.remoteUrls?.join("|")
              }
              className={
                "rounded-sm  bg-lightBlue-100 shadow-sm " +
                (index === contexts.length - 1 ? "" : "mb-2 ")
              }
            >
              <div
                onClick={() => {
                  switchContext(context, context, false);
                }}
                className="cursor-pointer text-white bg-gradient-to-br from-lightBlue-600 to-lightBlue-700 hover:from-lightBlue-700 hover:to-lightBlue-700"
              >
                <div className="text-sm px-2 py-1">
                  <div className="">
                    <span>{last(context.localContexts)?.finderRoot}</span>
                    {last(context.localContexts)?.isSubDb && (
                      <SubDatabaseHint className="ml-0.5" />
                    )}
                  </div>
                  {!!context.localContexts[0]?.remoteUrls && (
                    <div>
                      <div className="flex flex-row overflow-x-auto text-amber-400 font-bold">
                        Remote paths:
                        {context.localContexts[0].remoteUrls.join(" >> ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                {context.remoteOptionUrls?.map((url) => {
                  return (
                    <div
                      className="p-1 hover:bg-gray-300 cursor-pointer"
                      onClick={() => {
                        switchContext(
                          {
                            localContexts: [],
                            remoteUrls: (context.remoteUrls || []).concat([
                              url,
                            ]),
                          },
                          context,
                          true
                        );
                      }}
                      key={url}
                    >
                      {url}
                    </div>
                  );
                })}
                {context.localOptions?.map((db) => {
                  return (
                    <div
                      className="p-1 hover:bg-gray-300 cursor-pointer"
                      onClick={() => {
                        const { remoteUrls, localContexts } = context;
                        switchContext(
                          {
                            remoteUrls,
                            localContexts: localContexts.concat([db]),
                          },
                          context,
                          true
                        );
                      }}
                      key={db.finderRoot}
                    >
                      {db.finderRoot}
                    </div>
                  );
                })}
                {!context.remoteOptionUrls?.length &&
                  !context.localOptions?.length && (
                    <div className="p-1">Empty</div>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const IndicatorArrows = React.memo(
  (props: { contexts: WebContext[]; arrowClassName: string }) => {
    if (!props.contexts.length) return null;
    const [context, ...restContext] = props.contexts;
    return (
      <div className="flex flex-row-reverse ">
        <IndicatorArrows
          contexts={restContext}
          arrowClassName={props.arrowClassName}
        />
        <div className="overflow-hidden flex flex-row items-center">
          <div
            className={
              "pt-2/1 transform rotate-45 -translate-x-1/2 scale-x-150 scale-y-75 -mr-1/2 shadow-md cursor-pointer bg-gradient-to-tr " +
              (context.remoteUrls
                ? "from-cyan-300 to-cyan-600 hover:from-cyan-500 hover:to-cyan-500 "
                : "from-gray-100 to-gray-300 hover:from-cyan-500 hover:to-cyan-500 ") +
              props.arrowClassName
            }
          />
        </div>
      </div>
    );
  }
);

export const ContextIndicator = React.memo(() => {
  const [contexts] = usePickBehaviorSubjectValue(
    wEvGlobalState,
    (v) => v.contextStack
  );
  const lastContext = last(contexts);
  const lastLocal = last(lastContext?.localContexts);
  const finderRoot = lastLocal?.finderRoot;
  const popoverMouter = useRef<HTMLDivElement>(null);
  return (
    <div className="hide-popover-padding flex flex-row truncate">
      <Popover
        getPopupContainer={() => popoverMouter.current || document.body}
        zIndex={10}
        trigger="click"
        placement="bottomLeft"
        content={<ContextPannel />}
      >
        <div
          className="flex flex-row items-center truncate cursor-pointer"
          ref={popoverMouter}
        >
          {!!contexts.length && (
            <>
              <IndicatorArrows contexts={contexts} arrowClassName="w-2.5" />
              {lastLocal?.isSubDb && (
                <SubDatabaseHint hint="This database context is included by it's parent context." />
              )}
              <Tooltip title={finderRoot}>
                <div className="flex flex-row flex-shrink truncate ml-1">
                  <span>{finderRoot?.slice(0, 15)}</span>
                  <div className="truncate text-rtl flex-shrink">
                    {finderRoot?.slice(15)}
                  </div>
                </div>
              </Tooltip>
            </>
          )}
        </div>
      </Popover>
    </div>
  );
});
