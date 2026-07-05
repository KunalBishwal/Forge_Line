import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { OrgMembership } from './org-membership.entity';
import { Project } from './project.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index('idx_organizations_slug')
  slug: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ─── Relations ──────────────────────────────────────
  @OneToMany(() => OrgMembership, (m) => m.organization)
  memberships: OrgMembership[];

  @OneToMany(() => Project, (p) => p.organization)
  projects: Project[];
}
