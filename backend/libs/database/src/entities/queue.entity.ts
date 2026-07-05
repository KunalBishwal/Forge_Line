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
  Unique,
} from 'typeorm';
import { Project } from './project.entity';
import { RetryPolicy } from './retry-policy.entity';
import { Job } from './job.entity';
import { ScheduledJob } from './scheduled-job.entity';

@Entity('queues')
@Unique('uq_queue_project_slug', ['projectId', 'slug'])
export class Queue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index('idx_queues_project')
  projectId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'int', name: 'concurrency_limit', default: 5 })
  concurrencyLimit: number;

  @Column({ type: 'boolean', name: 'is_paused', default: false })
  isPaused: boolean;

  @Column({ type: 'uuid', name: 'retry_policy_id', nullable: true })
  retryPolicyId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Project, (p) => p.queues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => RetryPolicy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'retry_policy_id' })
  retryPolicy: RetryPolicy | null;

  @OneToMany(() => Job, (j) => j.queue)
  jobs: Job[];

  @OneToMany(() => ScheduledJob, (sj) => sj.queue)
  scheduledJobs: ScheduledJob[];
}
