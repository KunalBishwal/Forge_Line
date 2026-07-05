import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  Job, JobExecution, JobLog, Queue,
  DeadLetterEntry, Project, OrgMembership,
} from '@forgeline/database';
import { JobStatus, JobType, RetryStrategy, LogLevel } from '@forgeline/common';
import { EventsGateway } from '../gateway/events.gateway';
import { CreateJobDto } from './dto/create-job.dto';
import { JobFilterDto } from './dto/job-filter.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(JobExecution)
    private readonly executionRepo: Repository<JobExecution>,
    @InjectRepository(JobLog)
    private readonly logRepo: Repository<JobLog>,
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    @InjectRepository(DeadLetterEntry)
    private readonly dlqRepo: Repository<DeadLetterEntry>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(OrgMembership)
    private readonly membershipRepo: Repository<OrgMembership>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) { }

  /**
   * Creates a new job with idempotency key support.
   * Returns 409 Conflict if a job with the same idempotency key already exists in the queue.
   */
  async create(userId: string, dto: CreateJobDto) {
    const queue = await this.queueRepo.findOne({
      where: { id: dto.queueId },
      relations: ['retryPolicy'],
    });
    if (!queue) throw new NotFoundException('Queue not found');
    await this.assertProjectAccess(queue.projectId, userId);

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.jobRepo.findOne({
        where: { queueId: dto.queueId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        throw new ConflictException({
          message: 'Job with this idempotency key already exists',
          existingJobId: existing.id,
        });
      }
    }

    // Determine initial status and scheduled time
    let status = JobStatus.QUEUED;
    let scheduledAt: Date | null = null;

    if (dto.type === JobType.DELAYED && dto.delayMs) {
      status = JobStatus.SCHEDULED;
      scheduledAt = new Date(Date.now() + dto.delayMs);
    } else if (dto.type === JobType.SCHEDULED && dto.scheduledAt) {
      status = JobStatus.SCHEDULED;
      scheduledAt = new Date(dto.scheduledAt);
    }

    // Inherit retry config from queue policy or use job-level override
    const retryPolicy = queue.retryPolicy;
    const maxRetries = dto.maxRetries ?? retryPolicy?.maxRetries ?? 3;
    const retryStrategy = dto.retryStrategy ?? retryPolicy?.strategy ?? RetryStrategy.EXPONENTIAL;
    const retryDelayMs = dto.retryDelayMs ?? retryPolicy?.baseDelayMs ?? 1000;

    const job = this.jobRepo.create({
      queueId: dto.queueId,
      idempotencyKey: dto.idempotencyKey ?? null,
      type: dto.type ?? JobType.IMMEDIATE,
      status,
      priority: dto.priority ?? 0,
      payload: dto.payload ?? {},
      maxRetries,
      retryStrategy,
      retryDelayMs,
      scheduledAt,
    });

    await this.jobRepo.save(job);

    // Log creation
    await this.logRepo.save(
      this.logRepo.create({
        jobId: job.id,
        level: LogLevel.INFO,
        message: `Job created with type=${job.type}, status=${job.status}`,
        metadata: { priority: job.priority, maxRetries: job.maxRetries },
      }),
    );

    // Emit real-time event
    this.eventsGateway.emitJobUpdate(job);

    return job;
  }

  /**
   * Creates multiple jobs in a batch. Each job gets its own idempotency check.
   */
  async createBatch(userId: string, jobs: CreateJobDto[]) {
    if (jobs.length > 100) {
      throw new BadRequestException('Batch size cannot exceed 100 jobs');
    }

    const results: { job?: Job; error?: string; index: number }[] = [];

    for (let i = 0; i < jobs.length; i++) {
      try {
        const job = await this.create(userId, { ...jobs[i], type: JobType.BATCH });
        results.push({ job, index: i });
      } catch (error: any) {
        results.push({ error: error.message, index: i });
      }
    }

    return {
      total: jobs.length,
      created: results.filter((r) => r.job).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  }

  /**
   * List jobs with pagination, filtering, and sorting.
   */
  async findAll(userId: string, filters: JobFilterDto) {
    let page = Number(filters.page);
    if (isNaN(page) || page < 1) page = 1;
    let limit = Number(filters.limit);
    if (isNaN(limit) || limit < 1) limit = 25;
    limit = Math.min(limit, 100);
    const offset = (page - 1) * limit;

    const qb = this.jobRepo.createQueryBuilder('job')
      .leftJoinAndSelect('job.queue', 'queue');

    // Apply filters
    if (filters.queueId) {
      qb.andWhere('job.queueId = :queueId', { queueId: filters.queueId });
    }
    if (filters.status) {
      qb.andWhere('job.status = :status', { status: filters.status });
    }
    if (filters.type) {
      qb.andWhere('job.type = :type', { type: filters.type });
    }
    if (filters.search) {
      qb.andWhere(
        '(CAST(job.id AS TEXT) ILIKE :search OR job.idempotencyKey ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters.projectId) {
      qb.andWhere('queue.projectId = :projectId', { projectId: filters.projectId });
    }

    // Sorting
    const sortField = filters.sortBy === 'priority' ? 'job.priority' :
      filters.sortBy === 'status' ? 'job.status' :
        'job.createdAt'; //job.created_at
    const sortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortField, sortOrder);

    // Pagination
    const [data, total] = await qb.skip(offset).take(limit).getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get detailed job information with execution history and logs.
   */
  async findOne(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['queue', 'worker'],
    });
    if (!job) throw new NotFoundException('Job not found');

    const [executions, logs] = await Promise.all([
      this.executionRepo.find({
        where: { jobId },
        order: { attempt: 'ASC' },
      }),
      this.logRepo.find({
        where: { jobId },
        order: { createdAt: 'ASC' },
        take: 100,
      }),
    ]);

    return { ...job, executions, logs };
  }

  /**
   * Manually retry a failed job — resets status to queued.
   */
  async retry(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    if (![JobStatus.FAILED, JobStatus.DEAD_LETTER, JobStatus.CANCELLED].includes(job.status)) {
      throw new BadRequestException(`Cannot retry a job with status '${job.status}'`);
    }

    job.status = JobStatus.QUEUED;
    job.attempt = 0;
    job.error = null;
    job.scheduledAt = null;
    job.startedAt = null;
    job.completedAt = null;
    job.claimedBy = null;

    await this.jobRepo.save(job);

    await this.logRepo.save(
      this.logRepo.create({
        jobId: job.id,
        level: LogLevel.INFO,
        message: 'Job manually retried — status reset to queued',
      }),
    );

    this.eventsGateway.emitJobUpdate(job);
    return job;
  }

  /**
   * Cancel a queued or scheduled job.
   */
  async cancel(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    if (![JobStatus.QUEUED, JobStatus.SCHEDULED].includes(job.status)) {
      throw new BadRequestException(`Cannot cancel a job with status '${job.status}'`);
    }

    job.status = JobStatus.CANCELLED;
    job.completedAt = new Date();
    await this.jobRepo.save(job);

    await this.logRepo.save(
      this.logRepo.create({
        jobId: job.id,
        level: LogLevel.INFO,
        message: 'Job cancelled by user',
      }),
    );

    this.eventsGateway.emitJobUpdate(job);
    return job;
  }

  // ─── Helpers ────────────────────────────────────────

  private async assertProjectAccess(projectId: string, userId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const membership = await this.membershipRepo.findOne({
      where: { orgId: project.orgId, userId },
    });
    if (!membership) {
      throw new NotFoundException('Access denied');
    }
  }
}
