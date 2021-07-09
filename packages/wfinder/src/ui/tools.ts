export const simpleGetKey = (v: { id: number; dbRoot: string }) =>
  "id-" + v.id + "path-" + v.dbRoot;
