import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
export class ScanPath extends BaseEntity {
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
}
