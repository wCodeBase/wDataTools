import { TypeTagList } from "../common/types";
import { Combine } from "../common/typeTools";

export type TypeClientEvent = {
  connect: (id: string) => void;
  data: (id: string, data: any) => void;
  inited: () => void;
  tagList: (tagList: TypeTagList) => void;
};
