import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Queue } from './queue.entity';
import { Worker } from './worker.entity';
import { JobExecution } from './job-execution.entity';
import { JobLog } from './job-log.entity';
import { JobStatus, JobType, RetryStrategy } from '@forgeline/common';

@Entity('jobs')
@Index('idx_jobs_claim', ['queueId', 'status', 'priority', 'createdAt'])
@Index('idx_jobs_queue_status', ['queueId', 'status'])
@Index('idx_jobs_status', ['status'])
@Index('idx_jobs_scheduled', ['scheduledAt'], { where: `"status" = 'scheduled'` })
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'queue_id' })
  queueId: string;

  @Column({ type: 'varchar', length: 255, name: 'idempotency_key', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'enum', enum: JobType, default: JobType.IMMEDIATE })
  type: JobType;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.QUEUED })
  status: JobStatus;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'text', name: 'ai_error_summary', nullable: true })
  aiErrorSummary: string | null;

  @Column({ type: 'int', default: 0 })
  attempt: number;

  @Column({ type: 'int', name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({
    type: 'enum',
    enum: RetryStrategy,
    name: 'retry_strategy',
    default: RetryStrategy.EXPONENTIAL,
  })
  retryStrategy: RetryStrategy;

  @Column({ type: 'int', name: 'retry_delay_ms', default: 1000 })
  retryDelayMs: number;

  @Column({ type: 'timestamptz', name: 'scheduled_at', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'uuid', name: 'claimed_by', nullable: true })
  claimedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Queue, (q) => q.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;

  @ManyToOne(() => Worker, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'claimed_by' })
  worker: Worker | null;

  @OneToMany(() => JobExecution, (je) => je.job)
  executions: JobExecution[];

  @OneToMany(() => JobLog, (jl) => jl.job)
  logs: JobLog[];
}
