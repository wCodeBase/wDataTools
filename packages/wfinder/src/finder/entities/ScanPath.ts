import { BaseDbInfoEntity, SubDatabaseIterators } from "./BaseDbInfoEntity";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { joinToAbsolute, isPathInclude } from "../../tools/pathTool";
import fs from "fs";
import { EvLog } from "../events/events";
import { getConfig, switchDb } from "../db";

@Entity()
export class ScanPath extends BaseDbInfoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  path: string;

  /** If scan path is outside of current finderRoot, database file can be store under either current finderRoot or scan path. */
  @Column({ nullable: true })
  dbPath?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  lastScanedAt?: Date;

  @Column({ nullable: true, type: "text" })
  lastMessage?: string;

  constructor(path: string) {
    super();
    this.path = path;
  }
}

SubDatabaseIterators.push(async (cb) => {
  const config = getConfig();
  const scanPaths = await ScanPath.find();
  for (const scanPath of scanPaths) {
    if (!scanPath.dbPath) continue;
    const absDbPath = joinToAbsolute(config.finderRoot, scanPath.dbPath);
    const absFinderRoot = joinToAbsolute(config.finderRoot, scanPath.path);
    if (!fs.existsSync(absDbPath)) {
      EvLog(
        `It's time to rescan, database file of scan path not exist: ${absDbPath}.`
      );
    } else if (!isPathInclude(config.finderRoot, absFinderRoot)) {
      try {
        await switchDb(
          {
            dbName: config.dbName,
            finderRoot: absFinderRoot,
            dbPath: absDbPath,
            readOnly: true,
            isSubDb: true,
          },
          cb
        );
      } catch (e) {
        console.error("Query external scan path failed: ", absFinderRoot, e);
      }
    }
  }
});
