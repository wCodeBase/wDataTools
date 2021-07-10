import { BaseEntity } from "typeorm";
import { getSwitchedDbConfig } from "../db";

export class BaseDbInfoEntity extends BaseEntity {
  dbInfo = getSwitchedDbConfig();
}
