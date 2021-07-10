import { Config } from "./../finder/common";
export const simpleGetKey = (v: { id: number; dbInfo?: typeof Config }) =>
  "id-" + v.id + "path-" + v.dbInfo?.finderRoot;
