import { BehaviorSubject, Subject } from "rxjs";
import { TypeJsonData, TypeJsonObject } from "../../tools/json";
import { isCompleteType } from "../../tools/tool";

export class JsonBehaviorSubject<
  T extends TypeJsonData
> extends BehaviorSubject<T> {}

const shallowMergeSubjectValue = <T>(newData: Partial<T>, oldData: T) => {
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
