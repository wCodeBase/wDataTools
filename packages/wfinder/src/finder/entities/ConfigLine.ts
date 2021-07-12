import { TypeJsonData, _TypeJsonObject } from "./../../tools/json";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { TypeMsgConfigItem } from "../events/types";
import { ConfigLineType } from "../types";
import { BaseDbInfoEntity } from "./BaseDbInfoEntity";

@Entity()
export class ConfigLine extends BaseDbInfoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  content: string;

  @Column()
  type: ConfigLineType;

  @Column({ nullable: true })
  disabled?: boolean;

  @Column({ type: "text", nullable: true })
  jsonStr?: string;

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
    const {
      id,
      updatedAt,
      createdAt,
      content,
      type,
      dbInfo,
      disabled,
      jsonStr,
    } = this;
    return {
      id,
      updatedAt,
      createdAt,
      content,
      type,
      dbInfo,
      disabled,
      jsonStr,
    };
  }
}
