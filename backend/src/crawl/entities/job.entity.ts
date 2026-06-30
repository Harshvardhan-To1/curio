import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChunkEntity } from './chunk.entity';
import { PageEntity } from './page.entity';

export type JobState = 'pending' | 'running' | 'completed' | 'failed';

export interface JobOptions {
  maxPages: number;
  maxDepth: number;
  sameOriginOnly: boolean;
  respectRobots: boolean;
  requestsPerSecond: number;
}

export interface JobError {
  url: string;
  message: string;
  at: string;
}

@Entity('jobs')
export class JobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'text' })
  seedUrl!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  state!: JobState;

  @Column({ type: 'jsonb' })
  options!: JobOptions;

  @Column({ type: 'varchar', length: 16, default: 'thin-server' })
  embedMode!: string;

  @Column({ type: 'int', default: 0 })
  pagesFound!: number;

  @Column({ type: 'int', default: 0 })
  pagesDone!: number;

  @Column({ type: 'int', default: 0 })
  chunkCount!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors!: JobError[];

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PageEntity, (p) => p.job)
  pages!: PageEntity[];

  @OneToMany(() => ChunkEntity, (c) => c.job)
  chunks!: ChunkEntity[];
}
