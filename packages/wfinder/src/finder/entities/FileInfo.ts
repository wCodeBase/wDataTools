import {
  BaseEntity,
  Column,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum FileType {
  file,
  folder,
}

export const IndexTableName = "fileindex";

@Entity()
export class FileInfo extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Id of parent directory, value -1 means no parent */
  @Column()
  parentId: number;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "float" })
  size: number;

  @Column()
  type: FileType;

  constructor(name: string, type: FileType, parentId = -1, size = 0) {
    super();
    this.name = name;
    this.type = type;
    this.parentId = parentId;
    this.size = size;
  }

  async save() {
    const res = await super.save();
    await FileInfo.getRepository().query(
      `insert into ${IndexTableName}(docid, name) values(${
        this.id
      },'${textPreProcessor(this.name)}')`
    );
    return res;
  }

  static async findByMatchName(particalName: string) {
    const ids = await this.getRepository().query(
      `select docid from ${IndexTableName} where name match '${textPreProcessor(
        particalName
      )}'`
    );
    return await this.findByIds(ids.map((v: any) => v.docid));
  }
}

const textPreProcessor = (text: string) =>
  text
    .replace(/([^\d])?(\d+)([^\d])?/g, "$1 $2 $3")
    .replace(/([^\x00-\xff])/g, " $1 ");
