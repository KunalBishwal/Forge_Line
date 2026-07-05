import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Job } from './job.entity';
import { Worker } from './worker.entity';
import { ExecutionStatus } from '@forgeline/common';

@Entity('job_executions')
@Index('idx_job_executions_job', ['jobId'])
@Index('idx_job_executions_worker', ['workerId'])
export class JobExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_id' })
  jobId: string;

  @Column({ type: 'uuid', name: 'worker_id' })
  workerId: string;

  @Column({ type: 'int' })
  attempt: number;

  @Column({ type: 'enum', enum: ExecutionStatus, default: ExecutionStatus.RUNNING })
  status: ExecutionStatus;

  @Column({ type: 'timestamptz', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', name: 'duration_ms', nullable: true })
  durationMs: number | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Job, (j) => j.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @ManyToOne(() => Worker, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;
}
