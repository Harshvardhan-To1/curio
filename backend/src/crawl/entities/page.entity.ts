import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobEntity } from './job.entity';

export type PageStatus = 'ok' | 'skipped' | 'error';

@Entity('pages')
@Index(['jobId', 'url'], { unique: true })
export class PageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => JobEntity, (j) => j.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: JobEntity;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text', default: '' })
  title!: string;

  @Column({ type: 'varchar', length: 16, default: 'ok' })
  status!: PageStatus;

  @Column({ type: 'int', default: 0 })
  depth!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  contentHash!: string | null;

  @Column({ type: 'int', default: 0 })
  markdownLength!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  crawledAt!: Date;
}
