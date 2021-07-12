import { Config } from "./../finder/common";
export const simpleGetKey = (v: { id: number; dbInfo?: typeof Config }) =>
  "id-" +
  v.id +
  "remote" +
  v.dbInfo?.remoteUrls?.join("-/-") +
  "path-" +
  v.dbInfo?.finderRoot;
