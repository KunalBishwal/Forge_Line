import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Job, JobExecution, JobLog, DeadLetterEntry,
} from '@forgeline/database';
import {
  JobStatus, ExecutionStatus, LogLevel,
  calculateRetryDelay, RetryStrategy,
} from '@forgeline/common';
import { RetryService } from '../retry/retry.service';
import { AiSummaryService } from '../ai-summary/ai-summary.service';

/**
 * Job Executor — runs claimed jobs and manages the full lifecycle:
 * claimed → running → completed/failed → retry/DLQ
 */
@Injectable()
export class JobExecutorService {
  private readonly logger = new Logger(JobExecutorService.name);
  private workerId: string;
  private maxConcurrency: number;
  private activeJobs = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobExecution)
    private readonly executionRepo: Repository<JobExecution>,
    @InjectRepository(JobLog)
    private readonly logRepo: Repository<JobLog>,
    @InjectRepository(DeadLetterEntry)
    private readonly dlqRepo: Repository<DeadLetterEntry>,
    private readonly retryService: RetryService,
    private readonly aiSummary: AiSummaryService,
  ) {}

  initialize(workerId: string, maxConcurrency: number) {
    this.workerId = workerId;
    this.maxConcurrency = maxConcurrency;
  }

  getActiveCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Executes a claimed job. Does NOT block — returns a promise that resolves
   * when the job completes, fails, or gets scheduled for retry.
   */
  async execute(job: Job): Promise<void> {
    const jobPromise = this.executeInternal(job);
    this.activeJobs.set(job.id, jobPromise);

    jobPromise.finally(() => {
      this.activeJobs.delete(job.id);
    });

    return jobPromise;
  }

  private async executeInternal(job: Job): Promise<void> {
    const startedAt = new Date();

    try {
      // Transition: claimed → running
      await this.jobRepo.update(job.id, {
        status: JobStatus.RUNNING,
        startedAt,
        attempt: job.attempt + 1,
      });

      // Create execution record
      const execution = this.executionRepo.create({
        jobId: job.id,
        workerId: this.workerId,
        attempt: job.attempt + 1,
        status: ExecutionStatus.RUNNING,
        startedAt,
      });
      await this.executionRepo.save(execution);

      await this.logRepo.save(
        this.logRepo.create({
          jobId: job.id,
          level: LogLevel.INFO,
          message: `Job started by worker ${this.workerId}, attempt ${job.attempt + 1}`,
        }),
      );

      // ─── Execute the job ────────────────────────────
      // In a real system, this would dispatch to a job handler registry.
      // For this implementation, we simulate work with configurable behavior.
      const result = await this.simulateJobExecution(job);

      // ─── Job completed successfully ─────────────────
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await this.jobRepo.update(job.id, {
        status: JobStatus.COMPLETED,
        result: result,
        completedAt,
      });

      await this.executionRepo.update(execution.id, {
        status: ExecutionStatus.COMPLETED,
        completedAt,
        durationMs,
      });

      await this.logRepo.save(
        this.logRepo.create({
          jobId: job.id,
          level: LogLevel.INFO,
          message: `Job completed in ${durationMs}ms`,
          metadata: { durationMs, result },
        }),
      );

      this.logger.debug(`Job ${job.id} completed in ${durationMs}ms`);
    } catch (error: any) {
      await this.handleFailure(job, error, startedAt);
    }
  }

  /**
   * Handles job failure: determines whether to retry or move to DLQ.
   */
  private async handleFailure(job: Job, error: Error, startedAt: Date) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const currentAttempt = job.attempt + 1;

    this.logger.warn(
      `Job ${job.id} failed on attempt ${currentAttempt}: ${error.message}`,
    );

    // Update execution record
    await this.executionRepo
      .createQueryBuilder()
      .update()
      .set({
        status: ExecutionStatus.FAILED,
        completedAt,
        durationMs,
        error: error.message,
      })
      .where('job_id = :jobId AND attempt = :attempt', {
        jobId: job.id,
        attempt: currentAttempt,
      })
      .execute();

    // Calculate retry decision
    const retryResult = calculateRetryDelay(
      job.retryStrategy as RetryStrategy,
      currentAttempt,
      job.maxRetries,
      job.retryDelayMs,
      300000, // max delay 5 min
      true,   // jitter enabled
    );

    if (retryResult.shouldRetry) {
      // Schedule retry
      const nextRunAt = new Date(Date.now() + retryResult.delayMs);

      await this.jobRepo.update(job.id, {
        status: JobStatus.SCHEDULED,
        error: error.message,
        attempt: currentAttempt,
        scheduledAt: nextRunAt,
        claimedBy: null,
        startedAt: null,
      });

      await this.logRepo.save(
        this.logRepo.create({
          jobId: job.id,
          level: LogLevel.WARN,
          message: `Job scheduled for retry #${currentAttempt + 1} in ${retryResult.delayMs}ms (${job.retryStrategy})`,
          metadata: { delayMs: retryResult.delayMs, nextRunAt },
        }),
      );

      this.logger.debug(
        `Job ${job.id} scheduled for retry in ${retryResult.delayMs}ms`,
      );
    } else {
      // Max retries exceeded — move to Dead Letter Queue
      await this.moveToDeadLetterQueue(job, error, currentAttempt);
    }
  }

  /**
   * Moves a permanently failed job to the Dead Letter Queue.
   */
  private async moveToDeadLetterQueue(job: Job, error: Error, attempts: number) {
    // Update job status
    await this.jobRepo.update(job.id, {
      status: JobStatus.DEAD_LETTER,
      error: error.message,
      completedAt: new Date(),
      claimedBy: null,
    });

    // Generate AI error summary (async, non-blocking)
    let aiSummary: string | null = null;
    try {
      aiSummary = await this.aiSummary.summarizeError(error.message, error.stack);
      if (aiSummary) {
        await this.jobRepo.update(job.id, { aiErrorSummary: aiSummary });
      }
    } catch {
      // AI summary is best-effort, don't fail the DLQ operation
    }

    // Create DLQ entry
    const dlqEntry = this.dlqRepo.create({
      originalJobId: job.id,
      queueId: job.queueId,
      payload: job.payload,
      error: error.message,
      aiErrorSummary: aiSummary,
      attempts,
      failedAt: new Date(),
    });
    await this.dlqRepo.save(dlqEntry);

    await this.logRepo.save(
      this.logRepo.create({
        jobId: job.id,
        level: LogLevel.ERROR,
        message: `Job moved to Dead Letter Queue after ${attempts} failed attempts`,
        metadata: { dlqEntryId: dlqEntry.id, error: error.message },
      }),
    );

    this.logger.warn(`Job ${job.id} moved to DLQ after ${attempts} attempts`);
  }

  /**
   * Simulates job execution. In production, this would dispatch
   * to registered job handlers based on payload type.
   *
   * Configurable via job payload:
   * - payload.duration: execution time in ms (default: 500-3000ms random)
   * - payload.failRate: probability of failure (0.0-1.0, default: 0.15)
   * - payload.errorMessage: custom error message on failure
   */
  private async simulateJobExecution(
    job: Job,
  ): Promise<Record<string, any>> {
    const duration = job.payload.duration || Math.floor(Math.random() * 2500) + 500;
    const failRate = job.payload.failRate ?? 0.15;

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, duration));

    // Simulate random failures
    if (Math.random() < failRate) {
      throw new Error(
        job.payload.errorMessage ||
        `Simulated failure: ${['Connection timeout', 'Resource unavailable', 'Rate limit exceeded', 'Upstream service error', 'Data validation failed'][Math.floor(Math.random() * 5)]}`,
      );
    }

    return {
      processedAt: new Date().toISOString(),
      durationMs: duration,
      workerId: this.workerId,
      message: 'Job processed successfully',
    };
  }
}
