import { Popover } from "antd";
import { isEmpty } from "lodash";
import React, { forwardRef, useMemo, useRef } from "react";
import { EvFinderState } from "../../../finder/events/events";
import { TypeLinkedRemoteItem } from "../../../finder/events/types";
import { usePickBehaviorSubjectValue } from "../../hooks/hooks";
import { defaultPropsFc } from "../../tools/fc";

const totalLightCount = 3;
const lightArray = new Array(totalLightCount).fill(null);

const remoteColors = {
  unavailable: "bg-gray-500 ",
  broken: "bg-red-500 ",
  linked: "bg-teal-500 ",
};

const getRemoteItemStatus = (item: TypeLinkedRemoteItem) =>
  item.unavailable ? "unavailable" : item.broken ? "broken" : "linked";

export const LinkedRemoteLight = React.memo(
  forwardRef<HTMLDivElement, { className: string }>(
    (props: { className: string }, ref) => {
      const { className = "" } = props;
      const [remotes] = usePickBehaviorSubjectValue(
        EvFinderState,
        (v) => v.remotes
      );
      const getColor = useMemo(() => {
        const values = Object.values(remotes);
        const total = values.length;
        const status = {
          linked: 0,
          broken: 0,
          unavailable: 0,
        };
        values.forEach((v) => {
          status[getRemoteItemStatus(v)]++;
        });
        (Object.entries(status) as [keyof typeof status, number][]).forEach(
          ([k, v]) => (status[k] = Math.round((v / total) * totalLightCount))
        );
        return (index: number) => {
          if (index + 1 <= status.linked) return remoteColors.linked;
          else return remoteColors.broken;
        };
      }, [remotes]);

      return (
        <div
          ref={ref}
          className={
            "flex flex-row justify-center items-center flex-shrink-0 p-1 rounded bg-white " +
            className
          }
        >
          {lightArray.map((_, index) => {
            return (
              <span
                key={index}
                className={
                  "rounded-full shadow-sm w-1.5 h-1.5 " + getColor(index)
                }
              />
            );
          })}
        </div>
      );
    }
  )
);

export const LinkedRemoteStatusList = defaultPropsFc(
  { className: "" },
  (props) => {
    const [remotes] = usePickBehaviorSubjectValue(
      EvFinderState,
      (v) => v.remotes
    );

    return (
      <div
        className={
          "flex flex-col justify-center flex-shrink-0 max-w-vw3/5 max-h-vw4/5 " +
          props.className
        }
      >
        <div className="font-bold">Remote connections:</div>
        <div className="overflow-auto">
          {Object.entries(remotes).map(([url, remote], index) => {
            const status = getRemoteItemStatus(remote);
            return (
              <div
                key={index + "|" + url}
                className="flex flex-row justify-between items-center my-1"
              >
                <div>{url}:</div>
                <div
                  className={
                    "text-white px-1 rounded-sm ml-3 " + remoteColors[status]
                  }
                >
                  {status}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  true
);

export const LinkedRemoteIndicator = defaultPropsFc(
  { className: "" },
  (props) => {
    const [remotes] = usePickBehaviorSubjectValue(
      EvFinderState,
      (v) => v.remotes
    );
    const popoverMouter = useRef<HTMLDivElement>(null);
    if (isEmpty(remotes)) return null;
    return (
      <Popover
        getPopupContainer={() => popoverMouter.current || document.body}
        content={<LinkedRemoteStatusList />}
        trigger="hover"
        placement="bottomRight"
      >
        <div className={"flex flex-row items-center " + props.className}>
          <LinkedRemoteLight
            {...props}
            className="cursor-pointer"
            ref={popoverMouter}
          />
        </div>
      </Popover>
    );
  },
  true
);
