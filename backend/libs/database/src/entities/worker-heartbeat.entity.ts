import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Worker } from './worker.entity';

@Entity('worker_heartbeats')
@Index('idx_worker_heartbeats_worker', ['workerId'])
@Index('idx_worker_heartbeats_created', ['createdAt'])
export class WorkerHeartbeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'worker_id' })
  workerId: string;

  @Column({ type: 'int', default: 0 })
  load: number;

  @Column({ type: 'int', name: 'memory_mb', nullable: true })
  memoryMb: number | null;

  @Column({ type: 'float', name: 'cpu_percent', nullable: true })
  cpuPercent: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ─── Relations ──────────────────────────────────────
  @ManyToOne(() => Worker, (w) => w.heartbeats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;
}
