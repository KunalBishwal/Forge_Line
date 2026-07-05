import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Queue } from './queue.entity';

@Entity('scheduled_jobs')
@Index('idx_scheduled_jobs_next_run', ['nextRunAt'], { where: `"is_active" = true` })
@Index('idx_scheduled_jobs_queue', ['queueId'])
export class ScheduledJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'queue_id' })
  queueId: string;

  @Column({ type: 'varchar', length: 100, name: 'cron_expression' })
  cronExpression: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', name: 'next_run_at', nullable: true })
  nextRunAt: Date | null;

  @Column({ type: 'timestamptz', name: 'last_run_at', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Queue, (q) => q.scheduledJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;
}
