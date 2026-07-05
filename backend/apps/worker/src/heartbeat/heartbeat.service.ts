import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, WorkerHeartbeat } from '@forgeline/database';
import * as os from 'os';

/**
 * Heartbeat Service — sends periodic health signals to the database.
 * The Reaper uses these to detect crashed/stale workers.
 */
@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(WorkerHeartbeat)
    private readonly heartbeatRepo: Repository<WorkerHeartbeat>,
  ) {}

  start(workerId: string, intervalMs: number) {
    this.logger.log(`Heartbeat started (every ${intervalMs}ms)`);

    this.timer = setInterval(async () => {
      try {
        const memUsage = process.memoryUsage();
        const memoryMb = Math.round(memUsage.rss / 1024 / 1024);
        const cpus = os.cpus();
        const cpuPercent = cpus.reduce((acc, cpu) => {
          const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
          return acc + ((total - cpu.times.idle) / total) * 100;
        }, 0) / cpus.length;

        // Get current load from worker record
        const worker = await this.workerRepo.findOne({ where: { id: workerId } });
        const load = worker?.currentLoad || 0;

        // Update last heartbeat on worker
        await this.workerRepo.update(workerId, {
          lastHeartbeatAt: new Date(),
        });

        // Record heartbeat entry
        await this.heartbeatRepo.save(
          this.heartbeatRepo.create({
            workerId,
            load,
            memoryMb,
            cpuPercent: Math.round(cpuPercent * 100) / 100,
          }),
        );
      } catch (error: any) {
        this.logger.error(`Heartbeat failed: ${error.message}`);
      }
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Heartbeat stopped');
    }
  }
}
