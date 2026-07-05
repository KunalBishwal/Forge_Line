import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ScheduledJob, Job } from '@forgeline/database';
import { JobStatus, JobType } from '@forgeline/common';
import { parseExpression } from 'cron-parser';

/**
 * Scheduler Service — processes cron/recurring job definitions.
 *
 * Periodically checks for ScheduledJob entries where next_run_at <= now,
 * creates new Job instances from their templates, and computes the next run time.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ScheduledJob)
    private readonly scheduledJobRepo: Repository<ScheduledJob>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  start(intervalMs: number) {
    this.logger.log(`Scheduler started (checking every ${intervalMs}ms)`);

    this.timer = setInterval(async () => {
      try {
        await this.processDueSchedules();
        await this.promoteScheduledJobs();
      } catch (error: any) {
        this.logger.error(`Scheduler error: ${error.message}`);
      }
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Scheduler stopped');
    }
  }

  /**
   * Creates job instances from cron/recurring definitions that are due.
   */
  private async processDueSchedules() {
    const dueSchedules = await this.scheduledJobRepo.find({
      where: {
        isActive: true,
        nextRunAt: LessThanOrEqual(new Date()),
      },
    });

    for (const schedule of dueSchedules) {
      try {
        // Create a new job from the schedule template
        const job = this.jobRepo.create({
          queueId: schedule.queueId,
          type: JobType.RECURRING,
          status: JobStatus.QUEUED,
          payload: {
            ...schedule.payload,
            _scheduledJobId: schedule.id,
            _cronExpression: schedule.cronExpression,
          },
          priority: 0,
          maxRetries: 3,
        });
        await this.jobRepo.save(job);

        // Compute next run time
        const interval = parseExpression(schedule.cronExpression, {
          tz: schedule.timezone,
          currentDate: new Date(),
        });
        const nextRunAt = interval.next().toDate();

        await this.scheduledJobRepo.update(schedule.id, {
          lastRunAt: new Date(),
          nextRunAt,
        });

        this.logger.debug(
          `Created recurring job from schedule ${schedule.id}, next run: ${nextRunAt.toISOString()}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to process schedule ${schedule.id}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Promotes delayed/scheduled jobs that are due:
   * Jobs with status='scheduled' and scheduled_at <= now → status='queued'
   */
  private async promoteScheduledJobs() {
    const result = await this.jobRepo
      .createQueryBuilder()
      .update()
      .set({ status: JobStatus.QUEUED })
      .where('status = :status', { status: JobStatus.SCHEDULED })
      .andWhere('scheduled_at <= NOW()')
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.debug(`Promoted ${result.affected} scheduled job(s) to queued`);
    }
  }
}
