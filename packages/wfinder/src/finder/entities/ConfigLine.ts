import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { TypeMsgConfigItem } from "../events/types";
import { ConfigLineType, SCAN_CONFIG_SET } from "../types";
import { BaseDbInfoEntity } from "./BaseDbInfoEntity";
import { ScanPath } from "./ScanPath";

@Entity()
export class ConfigLine extends BaseDbInfoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  content = "";

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

const markScanConfigChange = async () => {
  const paths = await ScanPath.find();
  paths.forEach((v) => (v.configChanged = true));
  await ScanPath.save(paths);
};

// @ts-ignore
["save", "remove", "softRemove"].forEach((p: "save") => {
  const old = ConfigLine.prototype[p];
  ConfigLine.prototype[p] = async function (...args: any[]) {
    const res = await old.call(this, ...args);
    if (SCAN_CONFIG_SET.has(this.type)) {
      await markScanConfigChange();
    }
    return res;
  };
});

// @ts-ignore
["save", "remove", "softRemove"].forEach((p: "save") => {
  const old = ConfigLine[p];
  // @ts-ignore
  ConfigLine[p] = async function (...args: any[]) {
    // @ts-ignore
    const res = await old.apply(ConfigLine, args);
    if (
      args[0].find(
        (v: any) => v instanceof ConfigLine && SCAN_CONFIG_SET.has(v.type)
      )
    ) {
      await markScanConfigChange();
    }
    return res;
  };
});
