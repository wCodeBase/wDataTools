import { useRef } from "react";
import {
  WebEventStatus,
  wEvEventStatus,
  wEvFinderReady,
} from "./../../finder/events/webEvent";
import { useEffect, useReducer } from "react";
import { useUpdate } from "./hooks";

export const useFinderReady = (effect: React.EffectCallback) => {
  const update = useUpdate();
  useEffect(() => {
    const subscribe = wEvFinderReady.subscribe((ready) => {
      if (ready) {
        effect();
        update();
      }
    });
    return subscribe.unsubscribe.bind(subscribe);
  }, []);
};
