import { BaseDbInfoEntity } from "./BaseDbInfoEntity";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { getConfig } from "../db";
import { TypeMsgPathItem } from "../events/types";

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
  lastScanError?: string;

  constructor(path: string) {
    super();
    this.path = path;
  }
}
