import { isEqual } from "lodash";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BehaviorSubject, Subject } from "rxjs";

export const useStableState = <T extends Record<any, any>>(
  initializer: () => T
) => {
  const update = useUpdate();
  return useMemo(() => {
    const state = initializer();
    const setState = (values: Partial<T>) => {
      if (Object.entries(values).find(([key, val]) => state[key] !== val)) {
        Object.assign(state, values);
        update();
      }
    };
    return [state, setState, update] as [
      typeof state,
      typeof setState,
      typeof update
    ];
  }, []);
};

export const useUpdate = () => {
  const [, update] = useReducer((v) => v + 1, 0);
  return update;
};

export const useBehaviorSubjectValue = <T>(subject: BehaviorSubject<T>) => {
  const update = useUpdate();
  const timestamp = useRef<number>(Date.now());
  useEffect(() => {
    const sub = subject.subscribe(() => {
      timestamp.current = Date.now();
      update();
    });
    return () => sub.unsubscribe();
  }, []);
  return [subject.value, subject, timestamp.current] as [
    T,
    typeof subject,
    number
  ];
};

export const usePickBehaviorSubjectValue = <T, V>(
  subject: BehaviorSubject<T>,
  pick: (value: T) => V,
  deepEqual = true
) => {
  const update = useUpdate();
  const timestamp = useRef<number>(Date.now());
  const oldValue = useRef(pick(subject.value));
  useEffect(() => {
    const sub = subject.subscribe((value) => {
      const newValue = pick(value);
      if (newValue === oldValue.current) return;
      if (deepEqual && isEqual(newValue, oldValue.current)) return;
      oldValue.current = newValue;
      timestamp.current = Date.now();
      update();
    });
    return () => sub.unsubscribe();
  }, []);
  return [oldValue.current, subject, timestamp.current] as [
    V,
    typeof subject,
    number
  ];
};

export const useSubjectCallback = <T>(
  subject: Subject<T>,
  cb: (value: T) => void,
  deps: any[] = []
) => {
  useEffect(() => {
    const sub = subject.subscribe(cb);
    return () => sub.unsubscribe();
  }, deps);
};

export const useCountDown = (
  initialCount: number,
  deps: any[] = [],
  duration = 1000
) => {
  const [count, setCount] = useState(initialCount);
  useEffect(() => {
    setCount(initialCount);
    const interval = setInterval(() => {
      setCount((count) => {
        const res = count - 1;
        if (res <= 0) clearInterval(interval);
        return res;
      });
    }, duration);
    return () => clearInterval(interval);
  }, deps);
  return count;
};

/** Skip first effect callback execution */
export const useLaterEffect = (
  effect: React.EffectCallback,
  deps?: React.DependencyList | undefined
) => {
  const inited = useRef(false);
  useEffect(() => {
    if (!inited.current) {
      inited.current = true;
      return;
    }
    return effect();
  }, deps);
};
