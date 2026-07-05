import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Worker as WorkerEntity } from '@forgeline/database';
import { WorkerStatus, generateWorkerName } from '@forgeline/common';
import { JobClaimerService } from '../claimer/claimer.service';
import { JobExecutorService } from '../executor/executor.service';
import { HeartbeatService } from '../heartbeat/heartbeat.service';
import { ReaperService } from '../reaper/reaper.service';
import { SchedulerService } from '../scheduler/scheduler.service';

/**
 * Orchestrates the entire worker lifecycle:
 * 1. Register this worker in the database
 * 2. Start the polling loop (claim → execute)
 * 3. Start heartbeat, reaper, scheduler loops
 * 4. Handle graceful shutdown
 */
@Injectable()
export class WorkerOrchestratorService {
  private readonly logger = new Logger(WorkerOrchestratorService.name);
  private workerId: string;
  private workerName: string;
  private isRunning = false;
  private isDraining = false;
  private pollTimer: NodeJS.Timeout | null = null;

  private readonly maxConcurrency: number;
  private readonly pollIntervalMs: number;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(WorkerEntity)
    private readonly workerRepo: Repository<WorkerEntity>,
    private readonly dataSource: DataSource,
    private readonly claimer: JobClaimerService,
    private readonly executor: JobExecutorService,
    private readonly heartbeat: HeartbeatService,
    private readonly reaper: ReaperService,
    private readonly scheduler: SchedulerService,
  ) {
    this.maxConcurrency = this.config.get<number>('WORKER_MAX_CONCURRENCY', 10);
    this.pollIntervalMs = this.config.get<number>('WORKER_POLL_INTERVAL_MS', 1000);
    this.workerName = this.config.get<string>('WORKER_NAME') || generateWorkerName();
  }

  getWorkerName(): string { return this.workerName; }
  getWorkerId(): string { return this.workerId; }
  getMaxConcurrency(): number { return this.maxConcurrency; }
  getPollInterval(): number { return this.pollIntervalMs; }

  /**
   * Register this worker in the database and start all loops.
   */
  async start() {
    // Register in DB
    const worker = this.workerRepo.create({
      name: this.workerName,
      status: WorkerStatus.ONLINE,
      maxConcurrency: this.maxConcurrency,
      currentLoad: 0,
      registeredAt: new Date(),
      lastHeartbeatAt: new Date(),
    });
    const saved = await this.workerRepo.save(worker);
    this.workerId = saved.id;
    this.isRunning = true;

    this.logger.log(`Worker registered: ${this.workerName} (${this.workerId})`);

    // Initialize executor with worker ID
    this.executor.initialize(this.workerId, this.maxConcurrency);

    // Start subsystem loops
    this.heartbeat.start(this.workerId, this.config.get<number>('WORKER_HEARTBEAT_INTERVAL_MS', 10000));
    this.reaper.start(
      this.config.get<number>('REAPER_INTERVAL_MS', 30000),
      this.config.get<number>('REAPER_HEARTBEAT_TIMEOUT_MS', 60000),
      this.config.get<number>('REAPER_WORKER_OFFLINE_TIMEOUT_MS', 90000),
    );
    this.scheduler.start(10000); // Check cron every 10s

    // Start main poll loop
    this.poll();
  }

  /**
   * Main polling loop: claim jobs → execute them.
   * Adaptive polling: faster when busy, slower when idle.
   */
  private async poll() {
    if (!this.isRunning || this.isDraining) return;

    try {
      const availableSlots = this.maxConcurrency - this.executor.getActiveCount();
      if (availableSlots <= 0) {
        // At capacity — wait before polling again
        this.schedulePoll(this.pollIntervalMs);
        return;
      }

      // Claim batch of jobs (up to available slots)
      const jobs = await this.claimer.claimJobs(this.workerId, availableSlots);

      if (jobs.length > 0) {
        this.logger.debug(`Claimed ${jobs.length} job(s)`);

        // Update load in DB
        await this.workerRepo.update(this.workerId, {
          currentLoad: this.executor.getActiveCount() + jobs.length,
        });

        // Execute each claimed job concurrently
        for (const job of jobs) {
          this.executor.execute(job).then(() => {
            // After each job completes, update load
            this.workerRepo.update(this.workerId, {
              currentLoad: this.executor.getActiveCount(),
            }).catch(() => {});
          });
        }

        // Poll again immediately when there's work
        this.schedulePoll(50);
      } else {
        // No work — back off
        this.schedulePoll(this.pollIntervalMs);
      }
    } catch (error) {
      this.logger.error(`Poll error: ${error.message}`, error.stack);
      this.schedulePoll(this.pollIntervalMs * 2);
    }
  }

  private schedulePoll(delayMs: number) {
    if (!this.isRunning || this.isDraining) return;
    this.pollTimer = setTimeout(() => this.poll(), delayMs);
  }

  /**
   * Graceful shutdown:
   * 1. Set status to DRAINING — stop claiming new jobs
   * 2. Wait for in-flight jobs to complete (with timeout)
   * 3. Mark worker as OFFLINE
   */
  async shutdown() {
    this.logger.warn('Initiating graceful shutdown...');
    this.isDraining = true;
    this.isRunning = false;

    // Clear poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Mark as draining
    await this.workerRepo.update(this.workerId, {
      status: WorkerStatus.DRAINING,
    });

    // Stop subsystems
    this.heartbeat.stop();
    this.reaper.stop();
    this.scheduler.stop();

    // Wait for in-flight jobs (max 30s)
    const maxWaitMs = 30000;
    const start = Date.now();
    while (this.executor.getActiveCount() > 0 && Date.now() - start < maxWaitMs) {
      this.logger.log(`Waiting for ${this.executor.getActiveCount()} in-flight job(s)...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.executor.getActiveCount() > 0) {
      this.logger.warn(`Shutdown timeout — ${this.executor.getActiveCount()} jobs still running`);
    }

    // Mark as offline
    await this.workerRepo.update(this.workerId, {
      status: WorkerStatus.OFFLINE,
      currentLoad: 0,
    });

    this.logger.log('Worker marked as offline.');
  }
}
