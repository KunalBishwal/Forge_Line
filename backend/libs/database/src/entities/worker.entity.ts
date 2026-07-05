import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { WorkerHeartbeat } from './worker-heartbeat.entity';
import { WorkerStatus } from '@forgeline/common';

@Entity('workers')
@Index('idx_workers_status', ['status'])
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: WorkerStatus, default: WorkerStatus.ONLINE })
  status: WorkerStatus;

  @Column({ type: 'simple-array', nullable: true })
  queues: string[];

  @Column({ type: 'int', name: 'max_concurrency', default: 10 })
  maxConcurrency: number;

  @Column({ type: 'int', name: 'current_load', default: 0 })
  currentLoad: number;

  @Column({ type: 'timestamptz', name: 'registered_at' })
  registeredAt: Date;

  @Column({ type: 'timestamptz', name: 'last_heartbeat_at' })
  lastHeartbeatAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ─── Relations ──────────────────────────────────────
  @OneToMany(() => WorkerHeartbeat, (wh) => wh.worker)
  heartbeats: WorkerHeartbeat[];
}
