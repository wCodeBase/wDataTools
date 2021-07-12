import { FileInfo } from "./../../entities/FileInfo";
import {
  TypeJsonData,
  buildJsonMoreWithDefaultPackers,
  JsonMore,
  removeFunctionProperties,
  ErrorSpecialDataUnpack,
  _TypeJsonData,
  TypeDefaultSpecialJsonType,
} from "./../../../tools/json";
import { TypeQueryLimit } from "../../types";

export const JsonMoreEntity = buildJsonMoreWithDefaultPackers([
  {
    constructor: FileInfo,
    pack: (info) =>
      // @ts-ignore
      JsonMore.stringify(removeFunctionProperties(info)),
    unpack: (data) => {
      if (typeof data !== "string") throw new ErrorSpecialDataUnpack();
      return Object.assign(
        // @ts-ignore
        new FileInfo(),
        JsonMore.parse(data)
      );
    },
  },
]);

export type cTypeJsonMoreEntitySpecial = FileInfo;
export type cTypeImplementedOrmCall = "countByMatchName" | "findByMatchName";
export type cTypeOrmCallDef = {
  callOrmMethod: {
    data: {
      entityName: string;
      method: cTypeImplementedOrmCall;
      args: TypeJsonData[];
      queryLimit: TypeQueryLimit;
    };
    result: _TypeJsonData<
      cTypeJsonMoreEntitySpecial | TypeDefaultSpecialJsonType
    >;
  };
};
