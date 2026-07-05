import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Job, Worker } from '@forgeline/database';
import { JobStatus, WorkerStatus } from '@forgeline/common';

/**
 * Reaper Service — handles:
 * 1. Stuck jobs: running jobs where worker heartbeat has timed out
 * 2. Crashed workers: workers whose heartbeat is stale beyond threshold
 *
 * Re-queues stuck jobs so they can be claimed by healthy workers.
 */
@Injectable()
export class ReaperService {
  private readonly logger = new Logger(ReaperService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  start(intervalMs: number, heartbeatTimeoutMs: number, workerOfflineTimeoutMs: number) {
    this.logger.log(`Reaper started (every ${intervalMs}ms, heartbeat timeout: ${heartbeatTimeoutMs}ms)`);

    this.timer = setInterval(async () => {
      try {
        await this.reapStuckJobs(heartbeatTimeoutMs);
        await this.reapStaleWorkers(workerOfflineTimeoutMs);
      } catch (error: any) {
        this.logger.error(`Reaper error: ${error.message}`);
      }
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Reaper stopped');
    }
  }

  /**
   * Finds jobs in 'running' or 'claimed' status where the assigned worker's
   * last heartbeat exceeds the timeout. Re-queues them for another worker.
   */
  private async reapStuckJobs(heartbeatTimeoutMs: number) {
    const cutoff = new Date(Date.now() - heartbeatTimeoutMs);

    // Find stale workers
    const staleWorkers = await this.workerRepo.find({
      where: {
        status: WorkerStatus.ONLINE,
        lastHeartbeatAt: LessThan(cutoff),
      },
    });

    if (staleWorkers.length === 0) return;

    const staleWorkerIds = staleWorkers.map((w) => w.id);
    this.logger.warn(`Found ${staleWorkers.length} stale worker(s): ${staleWorkerIds.join(', ')}`);

    // Find stuck jobs assigned to stale workers
    const stuckJobs = await this.jobRepo
      .createQueryBuilder('job')
      .where('job.status IN (:...statuses)', {
        statuses: [JobStatus.RUNNING, JobStatus.CLAIMED],
      })
      .andWhere('job.claimedBy IN (:...workerIds)', { workerIds: staleWorkerIds })
      .getMany();

    if (stuckJobs.length === 0) return;

    this.logger.warn(`Re-queuing ${stuckJobs.length} stuck job(s)`);

    for (const job of stuckJobs) {
      // Re-queue with status 'queued' — the retry engine will handle attempt counting
      // when the job was in 'running', the attempt was already incremented
      await this.jobRepo.update(job.id, {
        status: JobStatus.QUEUED,
        claimedBy: null,
        startedAt: null,
      });

      this.logger.log(`Re-queued stuck job ${job.id} (was ${job.status} on worker ${job.claimedBy})`);
    }
  }

  /**
   * Marks workers as OFFLINE if their heartbeat is stale beyond the offline threshold.
   */
  private async reapStaleWorkers(workerOfflineTimeoutMs: number) {
    const cutoff = new Date(Date.now() - workerOfflineTimeoutMs);

    const result = await this.workerRepo
      .createQueryBuilder()
      .update()
      .set({ status: WorkerStatus.OFFLINE })
      .where('status IN (:...statuses)', {
        statuses: [WorkerStatus.ONLINE, WorkerStatus.DRAINING],
      })
      .andWhere('last_heartbeat_at < :cutoff', { cutoff })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(`Marked ${result.affected} worker(s) as offline`);
    }
  }
}
