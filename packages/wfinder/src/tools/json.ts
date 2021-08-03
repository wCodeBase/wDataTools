import { get, range, setWith } from "lodash";

type TypeKey = string | number;

export type _TypeSimpleData<T> =
  | string
  | number
  | boolean
  | null
  | void
  | T
  | _TypeSimpleData<T>[];

export type _TypeJsonObject<T> = {
  [key in TypeKey]:
    | _TypeSimpleData<T>
    | _TypeSimpleData<T>[]
    | _TypeJsonData<T>
    | _TypeJsonData<T>[];
};

export type _TypeJsonData<T> =
  | _TypeSimpleData<T>
  | _TypeJsonData<T>[]
  | _TypeJsonObject<T>;

export type TypeSpecialJsonPacker<T> = {
  constructor: (new (...p: any[]) => T) | ((...p: any[]) => T);
  pack: (data: T) => _TypeJsonData<void>;
  unpack: (json: _TypeJsonData<void>) => T;
  /** If source code will be uglified, an explicit name string should be privided */
  name?: string;
};

export const concatSpecialPackers = <T, Y>(
  packer: TypeSpecialJsonPacker<T>[],
  packer1: TypeSpecialJsonPacker<Y>[]
  // @ts-ignore
): TypeSpecialJsonPacker<T | Y>[] => [...packer, ...packer1];

const simpleJsonDataTypeSet = new Set(["string", "number", "boolean"]);
const specialValuePackers: [_TypeSimpleData<void>, string][] = [
  [undefined, "sp_undefined"],
  [NaN, "sp_NaN"],
  [Infinity, "sp_Infinity"],
  [-Infinity, "sp_neg_Infinity"],
];
const specialValueNameMap = new Map<any, string>(specialValuePackers);
const nameSpecialValueMap = new Map(
  specialValuePackers.map(([a, b]) => [b, a])
);
const SP_THESAME = "sp_thesame";

export type _TypeJsonMore<T> = {
  stringify: (data: _TypeJsonData<T>) => string;
  parse: (data: string) => _TypeJsonData<T>;
};

export type TypeJsonMore = _TypeJsonMore<any>;

export const buildJsonMore = <T>(
  specialPackers: TypeSpecialJsonPacker<T>[]
): _TypeJsonMore<T> => {
  const constructorPackerMap = new Map<any, TypeSpecialJsonPacker<T>>();
  const namePackerMap = new Map<string, TypeSpecialJsonPacker<T>>();
  specialPackers.forEach((packer) => {
    const name = packer.name || packer.constructor.name;
    if (namePackerMap.has(name) || nameSpecialValueMap.has(name))
      throw new Error(`Duplicated specialJsonPacker "${name}"`);
    namePackerMap.set(name, packer);
    if (constructorPackerMap.has(packer.constructor))
      throw new Error(`Duplicated specialJsonPacker constructor "${name}"`);
    constructorPackerMap.set(packer.constructor, packer);
  });

  type TypeJsonData = _TypeJsonData<T>;

  type JsonMoreData = {
    label: "JsonMoreData";
    data: _TypeJsonData<void>;
    special: { type: string; path: TypeKey[] }[];
  };
  const canSkipValue = Symbol();
  return {
    stringify: (data: TypeJsonData) => {
      const existObjPathMap = new Map<any, TypeKey[]>();

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
        let value: _TypeJsonData<void> | typeof canSkipValue = canSkipValue;
        const special = specialValueNameMap.get(srcValue);
        const exist =
          special || !(srcValue instanceof Object)
            ? undefined
            : existObjPathMap.get(srcValue);
        if (special) {
          res.special.push({ type: special, path });
        } else if (exist) {
          value = exist;
          res.special.push({ type: SP_THESAME, path });
        } else if (
          srcValue === null ||
          srcValue === undefined ||
          simpleJsonDataTypeSet.has(typeof srcValue)
        ) {
          // @ts-ignore
          value = srcValue;
        } else if (srcValue instanceof Array) {
          existObjPathMap.set(srcValue, path);
          if (srcValue.length)
            pathStack.push({
              path: [...path, 0],
              rest: srcValue.length > 1 ? range(1, srcValue.length) : [],
            });
          value = [];
          // @ts-ignore
        } else if (constructorPackerMap.has(srcValue["constructor"])) {
          // @ts-ignore
          const packer = constructorPackerMap.get(srcValue["constructor"]);
          if (packer) {
            existObjPathMap.set(srcValue, path);
            // @ts-ignore
            value = packer.pack(srcValue);
            res.special.push({
              type: packer.name || packer.constructor.name,
              path,
            });
          }
        } else if (srcValue instanceof Object) {
          if (srcValue instanceof Function) {
            value = canSkipValue;
          } else {
            existObjPathMap.set(srcValue, path);
            const [first, ...rest] = Object.keys(srcValue);
            if (first !== undefined)
              pathStack.push({ path: [...path, first], rest });
            value = {};
          }
        } else {
          throw new Error(
            `Failed to pack jsonMore value, unknown type: ${srcValue}`
          );
        }
        if (value !== canSkipValue) setWith(res, path, value, Object);
      }
      return JSON.stringify(res);
    },
    parse: (data: string) => {
      const json: JsonMoreData = JSON.parse(data);
      if (json.label !== "JsonMoreData") return json as _TypeJsonData<T>;
      json.special.forEach((special) => {
        const { type, path } = special;
        if (type === SP_THESAME) {
          setWith(json, path, get(json, get(json, path)), Object);
        } else if (nameSpecialValueMap.has(type)) {
          setWith(json, path, nameSpecialValueMap.get(type), Object);
        } else {
          const packer = namePackerMap.get(type);
          if (packer) {
            const value = get(json, path);
            setWith(json, path, packer.unpack(value), Object);
          } else {
            throw new Error("Unknown JsonMore special type: " + type);
          }
        }
      });
      return json.data as TypeJsonData;
    },
  };
};

export class ErrorSpecialDataUnpack extends Error {}
export class ErrorSpecialDatapack extends Error {}

export type TypeDefaultSpecialJsonType =
  | Date
  | BigInt
  | Set<TypeJsonData>
  | Map<TypeJsonData, TypeJsonData>;

export const defaultPackers: TypeSpecialJsonPacker<TypeDefaultSpecialJsonType>[] =
  [
    {
      constructor: Date,
      pack: (data) => {
        if (!(data instanceof Date)) throw new ErrorSpecialDatapack();
        return data.valueOf();
      },
      unpack: (data) => {
        if (typeof data !== "number") throw new ErrorSpecialDataUnpack();
        return new Date(data);
      },
    },
    {
      constructor: BigInt,
      pack: (data) => {
        if (typeof data !== "bigint") throw new ErrorSpecialDatapack();
        return data.toString();
      },
      unpack: (data) => {
        if (typeof data !== "string") throw new ErrorSpecialDataUnpack();
        return BigInt(data);
      },
    },
    {
      constructor: Set,
      pack: (data) => {
        if (!data || !(data instanceof Set)) throw new ErrorSpecialDatapack();
        return JsonMore.stringify(Array.from(data));
      },
      unpack: (data) => {
        if (typeof data !== "string") throw new ErrorSpecialDataUnpack();
        return new Set(JsonMore.parse(data) as any[]);
      },
    },
    {
      constructor: Map,
      pack: (data) => {
        if (!data || !(data instanceof Map)) throw new ErrorSpecialDatapack();
        return JsonMore.stringify(Array.from(data));
      },
      unpack: (data) => {
        if (typeof data !== "string") throw new ErrorSpecialDataUnpack();
        return new Map(JsonMore.parse(data) as any[]);
      },
    },
  ];

export type TypeSimpleData = _TypeSimpleData<TypeDefaultSpecialJsonType>;
export type TypeJsonData = _TypeJsonData<TypeDefaultSpecialJsonType>;
export type TypeJsonObject = _TypeJsonObject<TypeDefaultSpecialJsonType>;
export const JsonMore = buildJsonMore(defaultPackers);

export const buildJsonMoreWithDefaultPackers = <T>(
  specialPackers: TypeSpecialJsonPacker<T>[]
) => buildJsonMore(concatSpecialPackers(specialPackers, defaultPackers));

export const removeFunctionProperties = <T extends Record<string, any>>(
  v: T
) => {
  const res: Partial<T> = {};
  Object.entries(v).forEach(([k, v]) => {
    // @ts-ignore
    if (typeof v !== "function") res[k] = v;
  });
  return res;
};
