import { last } from "lodash";
import { waitMilli } from "../tools/tool";
import { getConfig, switchDb } from "./db";
import { ConfigLine } from "./entities/ConfigLine";
import { DbIncluded } from "./entities/DbIncluded";
import { FileInfo } from "./entities/FileInfo";
import { ScanPath } from "./entities/ScanPath";
import { TypeMsgConfigItem } from "./events/types";
import { ConfigLineType, TypeDbInfo } from "./types";
import path from "path";
import { isPathEqual, isPathInclude, joinToAbsolute } from "../tools/nodeTool";
import fs from "fs";

export const exAddScanPath = async (scanPath: string, config = getConfig()) => {
  return await switchDb(config, async () => {
    if (await ScanPath.count({ where: { path: scanPath } })) {
      const error = `Path already exist: ${scanPath}`;
      return { error };
    } else {
      const result = await new ScanPath(scanPath).save();
      return { result };
    }
  });
};

export const exDeleteScanPath = async (
  scanPath: string,
  config = getConfig()
) => {
  return await switchDb(config, async () => {
    const scanPaths = await ScanPath.find({ path: scanPath });
    if (!scanPaths.length) {
      const error = `No path exist, you need to add path first.`;
      return { error };
    } else {
      const scanPath = scanPaths[0];
      const absPath = joinToAbsolute(config.finderRoot, scanPath.path);
      const isIncluded = isPathInclude(config.finderRoot, absPath);
      if (isIncluded) {
        await FileInfo.removePath(scanPath.path);
        await DbIncluded.remove(
          await DbIncluded.find({
            where: { path: path.relative(config.finderRoot, absPath) },
          })
        );
      } else {
        if (scanPath.dbPath) {
          const absDbPath = joinToAbsolute(config.finderRoot, scanPath.dbPath);
          if (isPathInclude(config.finderRoot, absDbPath)) {
            fs.unlinkSync(absDbPath);
          }
        }
      }
      return { result: await scanPath.remove() };
    }
  });
};

export const exListScanPath = async (config = getConfig()) => {
  return await switchDb(config, async () => {
    const scanPaths = await ScanPath.find();
    return { result: scanPaths };
  });
};

export const exAddConfigLine = async (
  data: Pick<TypeMsgConfigItem, "type" | "content"> &
    Partial<TypeMsgConfigItem>,
  config = getConfig()
) => {
  return await switchDb(data.dbInfo || config, async () => {
    const { content, type } = data;
    if (await ConfigLine.count({ where: { content, type } })) {
      const error = `Content already exist: ${ConfigLineType[type]}-${content}.`;
      return { error };
    } else {
      const result = await Object.assign(
        new ConfigLine(content, type),
        data
      ).save();
      return { result };
    }
  });
};

export const exSaveConfigLine = async (
  item: Pick<TypeMsgConfigItem, "type"> & Partial<TypeMsgConfigItem>
) => {
  return await switchDb(item.dbInfo || getConfig(), async () => {
    const { content, type, id } = item;
    const configs = await ConfigLine.find({
      where: id === undefined ? { content, type } : { id },
    });
    if (!configs.length) {
      const error = `Content not found: ${ConfigLineType[type]}-${content}.`;
      return { error };
    } else {
      configs.forEach((config) => Object.assign(config, item));
      const result = await ConfigLine.save(configs);
      return { result };
    }
  });
};

export const exDeleteConfigLine = async (
  item: Pick<TypeMsgConfigItem, "type" | "content" | "dbInfo">
) => {
  return await switchDb(item.dbInfo || getConfig(), async () => {
    const { content, type } = item;
    const configLine = await ConfigLine.find({ content, type });
    if (!configLine.length) {
      const error = `Content dose not exist: ${ConfigLineType}-${content}.`;
      return { error };
    } else {
      const result = await ConfigLine.remove(configLine);
      return { result: result[0] };
    }
  });
};

export const exListConfigLine = async (
  item: Partial<TypeMsgConfigItem>,
  config = getConfig()
) => {
  return await switchDb(item.dbInfo || config, async () => {
    const configLines = await ConfigLine.find({
      where: item,
      order: { createdAt: "DESC" },
    });
    return { result: configLines };
  });
};

export const exListDbIncluded = async (config = getConfig()) => {
  return await switchDb(config, async () => {
    const dbIncludes = await (
      await DbIncluded.find()
    ).filter(
      (v) =>
        !isPathEqual(path.join(config.finderRoot, v.path), config.finderRoot)
    );
    return { result: dbIncludes };
  });
};

export const exClearIndexedData = async (config = getConfig()) => {
  return await switchDb(config, async () => {
    await FileInfo.removeAllIndexedData();
  });
};
