import { BaseDbInfoEntity } from "./BaseDbInfoEntity";
import { Config } from "./../common";
import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";
import { getSwitchedDbConfig } from "../db";
import * as path from "path";
import * as fs from "fs";

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
    const { finderRoot } = getSwitchedDbConfig();
    const subDbs = await this.find();
    for (const db of subDbs) {
      if (!fs.existsSync(path.join(finderRoot, db.path, db.dbName))) {
        await db.remove();
      }
    }
  }
}
