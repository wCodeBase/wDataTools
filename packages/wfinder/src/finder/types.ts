export enum FileType {
  file,
  folder,
}

export enum ConfigLineType {
  excludeFileName = 1,
  excludeChildrenFolderName,
}

export type TypeDbInfo = {
  /** Root path for indexing, only files included in this path will be scan and index */
  finderRoot: string;
  dbName: string;
  /** Absolute path for database connection */
  dbPath: string;
  readOnly: boolean;
};

export type HttpServerOption = {
  port: number;
  host: string;
};
