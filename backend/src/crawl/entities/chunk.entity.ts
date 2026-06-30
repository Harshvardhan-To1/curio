import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobEntity } from './job.entity';

@Entity('chunks')
@Index(['jobId', 'position'])
export class ChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => JobEntity, (j) => j.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: JobEntity;

  /** Stable content-derived id (sha1 of url::position::text, 16 hex). */
  @Index()
  @Column({ type: 'varchar', length: 32 })
  chunkId!: string;

  @Column({ type: 'text' })
  sourceUrl!: string;

  @Column({ type: 'text', default: '' })
  pageTitle!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  headingPath!: string[];

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'int', default: 0 })
  tokenEstimate!: number;

  @Column({ type: 'timestamptz' })
  crawledAt!: Date;

  /**
   * fat-server embedding vector (L2-normalized). Stored as JSON for portability;
   * when USE_PGVECTOR=true a parallel `embedding_vec vector(N)` column + ivfflat
   * index are maintained by StorageService for server-side ANN.
   */
  @Column({ type: 'jsonb', nullable: true })
  embedding!: number[] | null;
}
