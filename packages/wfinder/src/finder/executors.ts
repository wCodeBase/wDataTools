import { Config } from "./common";
import { switchDb } from "./db";
import { ConfigLine } from "./entities/ConfigLine";
import { ScanPath } from "./entities/ScanPath";
import { TypeMsgConfigItem } from "./events/types";
import { ConfigLineType } from "./types";

export const exAddScanPath = async (scanPath: string, config = Config) => {
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

export const exDeleteScanPath = async (scanPath: string, config = Config) => {
  return await switchDb(config, async () => {
    const scanPaths = await ScanPath.find({ path: scanPath });
    if (!scanPaths.length) {
      const error = `No path exist, you need to add path first.`;
      return { error };
    } else {
      const result = await ScanPath.remove(scanPaths);
      return { result: result[0] };
    }
  });
};

export const exListScanPath = async (config = Config) => {
  return await switchDb(config, async () => {
    const scanPaths = await ScanPath.find();
    return { result: scanPaths };
  });
};

export const exAddConfigLine = async (
  data: Pick<TypeMsgConfigItem, "type" | "content" | "dbInfo"> &
    Partial<TypeMsgConfigItem>,
  config = Config
) => {
  return await switchDb(config, async () => {
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
  item: Pick<TypeMsgConfigItem, "type" | "content" | "id" | "dbInfo"> &
    Partial<TypeMsgConfigItem>
) => {
  return await switchDb(item.dbInfo || Config, async () => {
    const config = await ConfigLine.findOne(item.id);
    const { content, type } = item;
    if (!config) {
      const error = `Content not found: ${ConfigLineType[type]}-${content}.`;
      return { error };
    } else {
      Object.assign(config, item);
      const result = await config.save();
      return { result };
    }
  });
};

export const exDeleteConfigLine = async (
  item: Pick<TypeMsgConfigItem, "type" | "content" | "dbInfo">
) => {
  return await switchDb(item.dbInfo || Config, async () => {
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
  type: ConfigLineType,
  config = Config
) => {
  return await switchDb(config, async () => {
    const configLines = await ConfigLine.find({
      where: { type },
      order: { createdAt: "DESC" },
    });
    return { result: configLines };
  });
};
