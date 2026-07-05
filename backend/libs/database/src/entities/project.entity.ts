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
import { Organization } from './organization.entity';
import { Queue } from './queue.entity';
import { RetryPolicy } from './retry-policy.entity';
import { RateLimit } from './rate-limit.entity';

@Entity('projects')
@Unique('uq_project_org_slug', ['orgId', 'slug'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'org_id' })
  @Index('idx_projects_org')
  orgId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Organization, (o) => o.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => Queue, (q) => q.project)
  queues: Queue[];

  @OneToMany(() => RetryPolicy, (rp) => rp.project)
  retryPolicies: RetryPolicy[];

  @OneToMany(() => RateLimit, (rl) => rl.project)
  rateLimits: RateLimit[];
}
