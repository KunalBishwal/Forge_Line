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
import { Queue } from './queue.entity';

@Entity('dead_letter_queue')
@Index('idx_dlq_queue', ['queueId'])
@Index('idx_dlq_original_job', ['originalJobId'])
@Index('idx_dlq_failed_at', ['failedAt'])
export class DeadLetterEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'original_job_id' })
  originalJobId: string;

  @Column({ type: 'uuid', name: 'queue_id' })
  queueId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'text' })
  error: string;

  @Column({ type: 'text', name: 'ai_error_summary', nullable: true })
  aiErrorSummary: string | null;

  @Column({ type: 'int' })
  attempts: number;

  @Column({ type: 'timestamptz', name: 'failed_at' })
  failedAt: Date;

  @Column({ type: 'timestamptz', name: 'replayed_at', nullable: true })
  replayedAt: Date | null;

  @Column({ type: 'uuid', name: 'replayed_job_id', nullable: true })
  replayedJobId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Job, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'original_job_id' })
  originalJob: Job;

  @ManyToOne(() => Queue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;

  @ManyToOne(() => Job, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replayed_job_id' })
  replayedJob: Job | null;
}
