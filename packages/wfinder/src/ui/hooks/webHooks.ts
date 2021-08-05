import { useEffect, useState } from "react";
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

const getWindowSize = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});
export const useWindowSize = () => {
  const [state, setState] = useState(getWindowSize);
  useEffect(() => {
    const listener = () => {
      setState(getWindowSize);
    };
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, []);
  return state;
};
