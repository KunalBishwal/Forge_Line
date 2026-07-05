import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { RetryStrategy } from '@forgeline/common';

@Entity('retry_policies')
export class RetryPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'project_id' })
  @Index('idx_retry_policies_project')
  projectId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: RetryStrategy, default: RetryStrategy.EXPONENTIAL })
  strategy: RetryStrategy;

  @Column({ type: 'int', name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ type: 'int', name: 'base_delay_ms', default: 1000 })
  baseDelayMs: number;

  @Column({ type: 'int', name: 'max_delay_ms', default: 300000 })
  maxDelayMs: number;

  @Column({ type: 'boolean', default: true })
  jitter: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Project, (p) => p.retryPolicies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
