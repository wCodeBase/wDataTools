import path from "path";
import { In } from "typeorm";
import { isPathEqual, isPathInclude, joinToAbsolute } from "wjstools";
import { getConfig, removeDbFiles, switchDb } from "./db";
import { ConfigLine } from "./entities/ConfigLine";
import { DbIncluded } from "./entities/DbIncluded";
import { FileInfo } from "./entities/FileInfo";
import { ScanPath } from "./entities/ScanPath";
import { TypeMsgConfigItem } from "./events/types";
import { ConfigLineType } from "./types";

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
            await removeDbFiles(absDbPath);
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

/**
 * Config will be added only if no config has the same content and type exists.
 */
export const exAddConfigLine = async (
  datas: (Pick<TypeMsgConfigItem, "type" | "content"> &
    Partial<TypeMsgConfigItem>)[],
  config = getConfig()
) => {
  const results = await Promise.all(
    datas.map(async (data) => {
      return await switchDb(data.dbInfo || config, async () => {
        const { id, content, type, ...rest } = data;
        let result = (await ConfigLine.find({ where: { content, type } }))[0];
        if (!result) {
          result = await Object.assign(new ConfigLine(content, type), {
            content,
            type,
            ...rest,
          }).save();
        }
        return result;
      });
    })
  );
  return { results };
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

export const exApplyConfigLines = async (
  ids: number[],
  mode: "add" | "delete",
  config = getConfig()
) => {
  return await switchDb(config, async () => {
    const configs = await ConfigLine.findByIds(ids);
    const getId = (v: ConfigLine) => JSON.stringify([v.type, v.content]);
    const types = Array.from(new Set(configs.map((v) => v.type)));
    if (mode === "add") {
      const configIdPairs = configs.map(
        (v) => [getId(v), v] as [string, ConfigLine]
      );
      await ConfigLine.queryAllDbIncluded(async () => {
        const exist = new Set(
          (await ConfigLine.find({ where: { type: In(types) } })).map(getId)
        );
        const applies = configIdPairs
          .filter((v) => !exist.has(v[0]))
          .map((v) => v[1]);
        const dbInfo = getConfig();
        applies.forEach((v) => {
          v.dbInfo = dbInfo;
          // @ts-ignore
          v.id = undefined;
        });
        await ConfigLine.save(applies);
        return [];
      });
    } else if (mode === "delete") {
      const included = new Set(configs.map(getId));
      await ConfigLine.queryAllDbIncluded(async () => {
        const toRemoves = (
          await ConfigLine.find({ where: { type: In(types) } })
        ).filter((v) => included.has(getId(v)));
        await ConfigLine.remove(toRemoves);
        return [];
      });
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
    const dbIncludes = (await DbIncluded.find()).filter(
      (v) =>
        !isPathEqual(path.join(config.finderRoot, v.path), config.finderRoot)
    );
    return { result: dbIncludes };
  });
};

export const exDeleteDbIncluded = async (
  config = getConfig(),
  paths: string[]
) => {
  return await switchDb(config, async () => {
    const dbIncludes = await DbIncluded.findByIds(paths);
    await Promise.all(
      dbIncludes.map((v) => {
        const absPath = path.join(config.finderRoot, v.path, v.dbName);
        return removeDbFiles(absPath);
      })
    );
    await DbIncluded.remove(dbIncludes);
    return { result: dbIncludes };
  });
};

export const exClearIndexedData = async (
  config = getConfig(),
  scanPaths?: string[]
) => {
  return await switchDb(config, async () => {
    if (scanPaths === undefined) await FileInfo.removeAllIndexedData();
    else {
      for (const p of scanPaths) {
        const absPath = joinToAbsolute(config.finderRoot, p);
        await exClearIndexedData({
          finderRoot: absPath,
          dbName: config.dbName,
          dbPath: path.join(absPath, config.dbName),
          isSubDb: true,
        });
      }
    }
  });
};
