import * as fs from "fs";
import * as path from "path";
import { Column, Entity, PrimaryColumn } from "typeorm";
import { isPathEqual } from "wjstools";
import { getConfig, switchDb } from "../db";
import { EvFinderStatus, EvLogWarn } from "../events/events";
import { Config } from "./../common";
import { BaseDbInfoEntity, SubDatabaseIterators } from "./BaseDbInfoEntity";

@Entity()
export class DbIncluded extends BaseDbInfoEntity {
  @PrimaryColumn()
  path: string;

  @Column()
  dbName: string;

  constructor(path: string, dbName = Config.dbName) {
    super();
    this.path = path;
    this.dbName = dbName;
  }

  static async mark(path: string, dbName = Config.dbName) {
    const record =
      (await DbIncluded.findOne(path)) || (await new this(path, dbName).save());
    if (record.dbName !== dbName) {
      record.dbName = dbName;
      await record.save();
    }
  }

  static async removeUnexists() {
    const { finderRoot } = getConfig();
    const subDbs = await this.find();
    for (const db of subDbs) {
      if (!fs.existsSync(path.join(finderRoot, db.path, db.dbName))) {
        await db.remove();
      }
    }
  }
}

SubDatabaseIterators.push(async (cb) => {
  const includedDbs = await DbIncluded.find();
  const config = getConfig();
  for (const db of includedDbs) {
    const finderRoot = path.join(config.finderRoot, db.path);
    if (isPathEqual(config.finderRoot, finderRoot)) continue;
    try {
      const dbPath = path.join(finderRoot, db.dbName);
      if (!fs.existsSync(dbPath)) {
        if (!EvFinderStatus.value.scanContextIdAndPathSet.size) {
          EvLogWarn(
            `It's time to rescan, sub database file not exist: ${dbPath}.`
          );
        }
      } else
        await switchDb(
          {
            dbName: db.dbName,
            finderRoot,
            dbPath,
            readOnly: true,
            isSubDb: true,
          },
          cb
        );
    } catch (e) {
      console.error("Query sub database failed: ", finderRoot, e);
    }
  }
});
