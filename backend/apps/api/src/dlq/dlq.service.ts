import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeadLetterEntry, Job, JobLog } from '@forgeline/database';
import { JobStatus, JobType, LogLevel } from '@forgeline/common';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class DlqService {
  constructor(
    @InjectRepository(DeadLetterEntry)
    private readonly dlqRepo: Repository<DeadLetterEntry>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobLog)
    private readonly logRepo: Repository<JobLog>,
    private readonly eventsGateway: EventsGateway,
  ) { }

  async findAll(filters?: { queueId?: string; page?: number; limit?: number }) {
    let page = Number(filters?.page);
    if (isNaN(page) || page < 1) page = 1;
    let limit = Number(filters?.limit);
    if (isNaN(limit) || limit < 1) limit = 25;
    limit = Math.min(limit, 100);
    const offset = (page - 1) * limit;

    const qb = this.dlqRepo.createQueryBuilder('dlq')
      .leftJoinAndSelect('dlq.queue', 'queue')
      .orderBy('dlq.failedAt', 'DESC');

    if (filters?.queueId) {
      qb.andWhere('dlq.queueId = :queueId', { queueId: filters.queueId });
    }

    const [data, total] = await qb
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const entry = await this.dlqRepo.findOne({
      where: { id },
      relations: ['queue', 'originalJob'],
    });
    if (!entry) throw new NotFoundException('DLQ entry not found');
    return entry;
  }

  /**
   * Replays a DLQ entry: creates a new job from the original payload
   * and marks the DLQ entry as replayed.
   */
  async replay(id: string) {
    const entry = await this.findOne(id);

    if (entry.replayedAt) {
      throw new BadRequestException('This DLQ entry has already been replayed');
    }

    // Create a new job from the DLQ payload
    const newJob = this.jobRepo.create({
      queueId: entry.queueId,
      type: JobType.IMMEDIATE,
      status: JobStatus.QUEUED,
      payload: entry.payload,
      priority: 0,
      attempt: 0,
      maxRetries: 3,
    });
    await this.jobRepo.save(newJob);

    // Mark DLQ entry as replayed
    entry.replayedAt = new Date();
    entry.replayedJobId = newJob.id;
    await this.dlqRepo.save(entry);

    // Log
    await this.logRepo.save(
      this.logRepo.create({
        jobId: newJob.id,
        level: LogLevel.INFO,
        message: `Replayed from DLQ entry ${entry.id}`,
        metadata: { originalJobId: entry.originalJobId },
      }),
    );

    this.eventsGateway.emitJobUpdate(newJob);

    return { dlqEntry: entry, newJob };
  }

  async discard(id: string) {
    const entry = await this.findOne(id);
    await this.dlqRepo.delete(entry.id);
    return { deleted: true };
  }
}
