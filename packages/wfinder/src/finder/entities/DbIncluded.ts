import { Config } from "./../common";
import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class DbIncluded extends BaseEntity {
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
}
