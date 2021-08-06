import { useEffect } from "react";
import { useUpdate } from "wjstools";
import { wEvFinderReady } from "./../../finder/events/webEvent";

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
