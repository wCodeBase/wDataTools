export enum FileType {
  file,
  folder,
}

export enum ConfigLineType {
  excludeFileName = 1,
  excludeChildrenFolderName,
  remoteUrl,
  coreInfo,
  userPreference,
}

export type TypeDbInfo = {
  /** Root path for indexing, only files included in this path will be scan and index */
  finderRoot: string;
  dbName: string;
  /** Absolute path for database connection */
  dbPath: string;
  readOnly?: boolean;
  remoteUrls?: string[];
  thumbnail?: string;
  /** Is info from ScanPath or DbIncluded */
  isSubDb?: boolean;
};

export const getDbInfoId = (info?: TypeDbInfo) =>
  !info ? "" : info.thumbnail + "|" + info.dbPath;

export const getLocalDbInfoStackId = (infos: TypeDbInfo[]) =>
  !infos.length
    ? ""
    : getDbInfoId(infos[0]) +
      infos
        .slice(1)
        .map((v) => v.dbPath)
        .join("|");

export type HttpServerOption = {
  port: number;
  host: string;
};

export type TypeFinderCoreInfo = {
  thumnail: string;
};

export type TypeQueryLimit = {
  dbThumnailStack: string[];
  remoteLimit: number;
};

export enum IncludeDbType {
  subDatabase = 1,
  scanPathExternal,
}
