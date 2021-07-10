import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { getSwitchedDbConfig } from "../db";
import { TypeMsgConfigItem } from "../events/types";
import { ConfigLineType } from "../types";
import { BaseDbInfoEntity } from "./Template";

@Entity()
export class ConfigLine extends BaseDbInfoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  content: string;

  @Column()
  type: ConfigLineType;

  @UpdateDateColumn()
  updatedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  constructor(content: string, type: ConfigLineType) {
    super();
    this.content = content;
    this.type = type;
  }

  toItem(): TypeMsgConfigItem {
    const { id, updatedAt, content, type, dbInfo } = this;
    return { id, updatedAt, content, type, dbInfo };
  }
}
