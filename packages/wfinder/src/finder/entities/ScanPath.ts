import { BaseDbInfoEntity } from "./BaseDbInfoEntity";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { getSwitchedDbConfig } from "../db";
import { TypeMsgPathItem } from "../events/types";

@Entity()
export class ScanPath extends BaseDbInfoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  path: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  lastScanedAt?: Date;

  constructor(path: string) {
    super();
    this.path = path;
  }

  toItem(): TypeMsgPathItem {
    const { id, path, createdAt, dbInfo } = this;
    return { id, path, createdAt, dbInfo };
  }
}
