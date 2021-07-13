import { useRef } from "react";
import { WebEventStatus, wEvEventStatus } from "./../../finder/events/webEvent";
import { useEffect, useReducer } from "react";
import { EvFinderReady } from "../../finder/events/events";
import { useUpdate } from "./hooks";

export const useEventReady = (effect: React.EffectCallback) => {
  const [val, update] = useReducer((v) => v + 1, 0);
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current) return;
    if (wEvEventStatus.value === WebEventStatus.connected) {
      triggered.current = true;
      return effect();
    } else {
      const subscribe = wEvEventStatus.subscribe((status) => {
        if (status === WebEventStatus.connected) {
          update();
          subscribe.unsubscribe();
        }
      });
    }
  }, [val]);
};

export const useFinderReady = (effect: React.EffectCallback) => {
  const update = useUpdate();
  useEffect(() => {
    const subscribe = EvFinderReady.subscribe((ready) => {
      if (ready) {
        effect();
        update();
      }
    });
    return subscribe.unsubscribe.bind(subscribe);
  }, []);
};
