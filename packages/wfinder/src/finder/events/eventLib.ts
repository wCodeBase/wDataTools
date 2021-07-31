import { BehaviorSubject, Subject } from "rxjs";
import { TypeJsonData, TypeJsonObject } from "../../tools/json";
import { isCompleteType } from "../../tools/tool";

export class JsonBehaviorSubject<
  T extends TypeJsonData
> extends BehaviorSubject<T> {}

const shallowMergeSubjectValue = <T>(newData: Partial<T>, oldData: T) => {
  if (newData === oldData) return oldData;
  return isCompleteType(newData, oldData)
    ? newData
    : { ...oldData, ...newData };
};
export class ShallowBehaviorSubject<
  T extends Record<string, any>
> extends BehaviorSubject<T> {
  constructor(value: T) {
    super(value);
  }
  next(v: Partial<T>) {
    this.value;
    super.next(shallowMergeSubjectValue(v, this.value));
  }
}
export class ShallowJsonBehaviorSubject<
  T extends TypeJsonObject
> extends JsonBehaviorSubject<T> {
  constructor(value: T) {
    super(value);
  }
  next(v: Partial<T>) {
    this.value;
    super.next(shallowMergeSubjectValue(v, this.value));
  }
}

export class JsonSubject<T extends TypeJsonData> extends Subject<T> {}

export type TypeComsumableEventObserver<T> = {
  next: (v: T) => boolean | void;
  error: (err: any) => boolean | void;
  destory: () => void;
};

export type TypeComsumableEventSubscribe = {
  unsubscribe: () => void;
};

export class ComsumableEvent<T> {
  private observers: Partial<TypeComsumableEventObserver<T>>[] = [];

  private parentSubscribe: TypeComsumableEventSubscribe | undefined;

  private destoried = false;

  subscribe(
    observer:
      | Partial<TypeComsumableEventObserver<T>>
      | TypeComsumableEventObserver<T>["next"]
  ) {
    const listener =
      typeof observer === "object" ? observer : { next: observer };
    if (this.destoried) {
      console.warn("Subscribe to destoried ComsumableEvent");
      return;
    } else {
      this.observers.unshift(listener);
    }
    return {
      unsubscribe: () => {
        this.observers = this.observers.filter((v) => v !== listener);
      },
    };
  }
  split<K = T>(mapper: (v: T) => K) {
    const subEvent = new ComsumableEvent<K>();
    const sub = this.subscribe({
      next: (data) => subEvent.next(mapper(data)),
      error: (err) => subEvent.error(err),
      destory: () => subEvent.destory(),
    });
    subEvent.parentSubscribe = sub;
    return subEvent;
  }
  next(v: T) {
    if (this.destoried) {
      console.warn("Fill data to destoried ComsumableEvent");
      return;
    }
    return !!this.observers.find((cb) => cb.next?.(v));
  }
  error(err: any) {
    return !!this.observers.find((cb) => cb.error?.(err));
  }
  destory() {
    this.destoried = true;
    this.observers.forEach((cb) => cb.destory?.());
    this.observers = [];
    this.parentSubscribe?.unsubscribe();
    this.parentSubscribe = undefined;
  }
  isDestoried() {
    return this.destoried;
  }
}
