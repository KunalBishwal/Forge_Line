import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Project } from './project.entity';
import { Queue } from './queue.entity';

@Entity('rate_limits')
@Check(`"project_id" IS NOT NULL OR "queue_id" IS NOT NULL`)
export class RateLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  @Index('idx_rate_limits_project')
  projectId: string | null;

  @Column({ type: 'uuid', name: 'queue_id', nullable: true })
  @Index('idx_rate_limits_queue')
  queueId: string | null;

  @Column({ type: 'int', name: 'max_per_second', default: 100 })
  maxPerSecond: number;

  @Column({ type: 'int', name: 'max_per_minute', default: 1000 })
  maxPerMinute: number;

  @Column({ type: 'int', name: 'window_size_ms', default: 60000 })
  windowSizeMs: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Project, (p) => p.rateLimits, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @ManyToOne(() => Queue, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_id' })
  queue: Queue | null;
}
