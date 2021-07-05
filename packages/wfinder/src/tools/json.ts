import { get, range, setWith } from "lodash";

type TypeKey = string | number;

type _TypeSimpleData<T> =
  | string
  | number
  | boolean
  | null
  | void
  | T
  | _TypeSimpleData<T>[];
type _TypeJsonData<T> =
  | _TypeSimpleData<T>
  | _TypeJsonData<T>[]
  | {
      [key in TypeKey]:
        | _TypeSimpleData<T>
        | _TypeSimpleData<T>[]
        | _TypeJsonData<T>
        | _TypeJsonData<T>[];
    };

export type TypeSimpleData = _TypeSimpleData<Date>;
export type TypeJsonData = _TypeJsonData<Date>;
let tt: _TypeJsonData<Date> = {};
const ll: { data: _TypeJsonData<Date> } = { data: tt };
tt = ll;

type JsonMoreData = {
  label: "JsonMoreData";
  data: _TypeJsonData<void>;
  special: { type: "Date"; path: TypeKey[] }[];
};

export const JsonMore = {
  stringify: (data: TypeJsonData) => {
    const res: JsonMoreData = {
      label: "JsonMoreData",
      data: undefined,
      special: [],
    };
    const src = { data };
    const pathStack: { path: TypeKey[]; rest: TypeKey[] }[] = [
      { path: ["data"], rest: [] },
    ];
    while (true) {
      const item = pathStack.pop();
      if (item === undefined) break;
      const { path, rest } = item;
      const first = rest.pop();
      if (first) {
        pathStack.push({ path: [...path.slice(0, -1), first], rest });
      }
      const srcValue: TypeJsonData = get(src, path);
      let value: _TypeJsonData<void>;
      if (srcValue instanceof Date) {
        res.special.push({ type: "Date", path });
        value = srcValue.valueOf();
      } else if (srcValue instanceof Array) {
        pathStack.push({ path: [...path, 0], rest: range(1, srcValue.length) });
        value = [];
      } else if (srcValue instanceof Object) {
        const [first, ...rest] = Object.keys(srcValue);
        pathStack.push({ path: [...path, first], rest });
        value = {};
      } else {
        value = srcValue;
      }
      setWith(res, path, value, Object);
    }
    return JSON.stringify(res);
  },
  parse: (data: string) => {
    const json: JsonMoreData = JSON.parse(data);
    if (json.label !== "JsonMoreData") return null;
    json.special.forEach((special) => {
      const { type, path } = special;
      if (type === "Date") {
        const value = get(json, path);
        if (typeof value === "number")
          setWith(json, path, new Date(value), Object);
      } else {
        throw new Error("Unknown JsonMore special type: " + type);
      }
    });
    return json.data as TypeJsonData;
  },
};
