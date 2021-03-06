import { useEffect } from "react";
import { wEvFinderReady } from "./../../finder/events/webEvent";
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
