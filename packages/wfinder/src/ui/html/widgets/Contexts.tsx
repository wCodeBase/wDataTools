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
} from "../../../finder/events/webEvent";
import { webInitEvent } from "../../../finder/events/webEventTools";
import { getDbInfoId } from "../../../finder/types";
import { usePickBehaviorSubjectValue } from "../../hooks/hooks";

export const ContextPannel = React.memo(() => {
  const [contexts] = usePickBehaviorSubjectValue(
    wEvGlobalState,
    (v) => v.contextStack
  );

  const isCurrent = useMemo(() => {
    const lastContext = last(contexts);
    if (!lastContext) return () => false;
    return (remoteUrls?: string[]) => {
      // TODO: support sub-database context.
      if (!remoteUrls && !lastContext.remoteUrls) return true;
      else if (!!remoteUrls !== !!lastContext.remoteUrls) return false;
      return isEqual(remoteUrls, lastContext.remoteUrls);
    };
  }, [contexts]);

  // TODO: support sub-database context.
  const switchContext = useCallback(
    async (remoteUrls?: string[]) => {
      const isCurrentContext = isCurrent(remoteUrls);
      if (isCurrentContext && !remoteUrls) {
        message.warn("Already in root database context");
        return;
      }
      const msg = isCurrentContext
        ? "Refresh current context"
        : "Switch database context";
      try {
        let contexts = wEvGlobalState.value.contextStack;
        EvFinderState.value.config = undefined;
        wEvFinderReady.next(false);
        if (!remoteUrls) {
          await webInitEvent(undefined, true);
          wEvGlobalState.next({ contextStack: contexts.slice(0, 1) });
        } else {
          const res = await webInitEvent(remoteUrls, true);
          const newContext = {
            localContexts: [res],
            remoteUrls,
          };
          const theSamePos = contexts.findIndex((v) =>
            isEqual(v.remoteUrls, newContext.remoteUrls)
          );
          if (theSamePos > 0) contexts = contexts.slice(0, theSamePos);
          wEvGlobalState.next({ contextStack: contexts.concat(newContext) });
        }
        message.success(msg + " success");
      } catch (e) {
        message.error(`${msg} failed: ${e}`);
      }
    },
    [isCurrent]
  );

  return (
    <div className="w-vw9/10 max-w-3xl mhvh4/5 flex flex-col break-all">
      <div className="text-lg font-bold p-2 pb-0">Database context</div>
      <div className="flex-grow overflow-y-auto p-2">
        {contexts.map((context, index) => {
          return (
            <div
              key={
                getDbInfoId(context.localContexts[0]) +
                context.remoteUrls?.join("|")
              }
              className={
                "rounded-sm  bg-lightBlue-100 shadow-sm " +
                (index === contexts.length - 1 ? "" : "mb-2 ")
              }
            >
              <div
                onClick={() => {
                  switchContext(context.remoteUrls);
                }}
                className="cursor-pointer text-white bg-gradient-to-br from-lightBlue-600 to-lightBlue-700 hover:from-lightBlue-700 hover:to-lightBlue-700"
              >
                <div className="text-sm px-2 py-1">
                  {context.localContexts[0].finderRoot}
                  {!!context.localContexts[0].remoteUrls && (
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
                {!!context.remoteOptionUrls && (
                  <div>
                    {context.remoteOptionUrls.map((url) => {
                      return (
                        <div
                          className="p-1 hover:bg-gray-300 cursor-pointer"
                          onClick={() => {
                            switchContext(
                              (context.remoteUrls || []).concat([url])
                            );
                          }}
                          key={url}
                        >
                          {url}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* TODO: support sub-database context. */}
                {/* {context.localContexts.slice(1).map(db => {
              return <div
                className="p-1 hover:bg-gray-300 cursor-pointer"
                onClick={() => {
                  // TODO:
                }}
                key={db.finderRoot}>{db.finderRoot}</div>
            })} */}
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
  const finderRoot = lastContext
    ? last(lastContext.localContexts)?.finderRoot
    : "";
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
              <Tooltip title={finderRoot}>
                <div className="flex-shrink truncate ml-1 ">{finderRoot}</div>
              </Tooltip>
            </>
          )}
        </div>
      </Popover>
    </div>
  );
});
