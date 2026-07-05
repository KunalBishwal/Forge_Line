import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue, Job, Project, OrgMembership } from '@forgeline/database';
import { JobStatus, slugify } from '@forgeline/common';
import { EventsGateway } from '../gateway/events.gateway';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';

@Injectable()
export class QueuesService {
  constructor(
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(OrgMembership)
    private readonly membershipRepo: Repository<OrgMembership>,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(userId: string, projectId: string, dto: CreateQueueDto) {
    await this.assertProjectAccess(projectId, userId);

    const queue = this.queueRepo.create({
      projectId,
      name: dto.name,
      slug: slugify(dto.name),
      priority: dto.priority ?? 0,
      concurrencyLimit: dto.concurrencyLimit ?? 5,
      retryPolicyId: dto.retryPolicyId ?? null,
    });

    return this.queueRepo.save(queue);
  }

  async findAllForProject(userId: string, projectId: string) {
    await this.assertProjectAccess(projectId, userId);

    const queues = await this.queueRepo.find({
      where: { projectId },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });

    // Attach live stats
    return Promise.all(queues.map((q) => this.attachStats(q)));
  }

  async findOne(userId: string, queueId: string) {
    const queue = await this.queueRepo.findOne({
      where: { id: queueId },
      relations: ['retryPolicy'],
    });
    if (!queue) throw new NotFoundException('Queue not found');
    await this.assertProjectAccess(queue.projectId, userId);
    return this.attachStats(queue);
  }

  async update(userId: string, queueId: string, dto: UpdateQueueDto) {
    const queue = await this.findOneRaw(queueId);
    await this.assertProjectAccess(queue.projectId, userId);

    Object.assign(queue, {
      ...(dto.name && { name: dto.name, slug: slugify(dto.name) }),
      ...(dto.concurrencyLimit !== undefined && { concurrencyLimit: dto.concurrencyLimit }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.retryPolicyId !== undefined && { retryPolicyId: dto.retryPolicyId }),
    });

    return this.queueRepo.save(queue);
  }

  async pause(userId: string, queueId: string) {
    const queue = await this.findOneRaw(queueId);
    await this.assertProjectAccess(queue.projectId, userId);
    queue.isPaused = true;
    await this.queueRepo.save(queue);
    this.eventsGateway.emitQueueUpdate(queueId, { isPaused: true });
    return { paused: true };
  }

  async resume(userId: string, queueId: string) {
    const queue = await this.findOneRaw(queueId);
    await this.assertProjectAccess(queue.projectId, userId);
    queue.isPaused = false;
    await this.queueRepo.save(queue);
    this.eventsGateway.emitQueueUpdate(queueId, { isPaused: false });
    return { paused: false };
  }

  async delete(userId: string, queueId: string) {
    const queue = await this.findOneRaw(queueId);
    await this.assertProjectAccess(queue.projectId, userId);
    await this.queueRepo.delete(queueId);
    return { deleted: true };
  }

  async getStats(userId: string, queueId: string) {
    await this.findOne(userId, queueId);
    return this.getQueueStats(queueId);
  }

  // ─── Internal Helpers ───────────────────────────────

  private async findOneRaw(queueId: string): Promise<Queue> {
    const queue = await this.queueRepo.findOne({ where: { id: queueId } });
    if (!queue) throw new NotFoundException('Queue not found');
    return queue;
  }

  private async attachStats(queue: Queue) {
    const stats = await this.getQueueStats(queue.id);
    return { ...queue, stats };
  }

  async getQueueStats(queueId: string) {
    const result = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('job.queueId = :queueId', { queueId })
      .groupBy('job.status')
      .getRawMany();

    const stats: Record<string, number> = {
      queued: 0,
      scheduled: 0,
      claimed: 0,
      running: 0,
      completed: 0,
      failed: 0,
      dead_letter: 0,
    };

    for (const row of result) {
      stats[row.status] = parseInt(row.count, 10);
    }

    // Throughput: completed jobs in the last minute
    const throughput = await this.jobRepo
      .createQueryBuilder('job')
      .where('job.queueId = :queueId', { queueId })
      .andWhere('job.status = :status', { status: JobStatus.COMPLETED })
      .andWhere('job.completedAt > NOW() - INTERVAL \'1 minute\'')
      .getCount();

    return { ...stats, throughputPerMinute: throughput };
  }

  private async assertProjectAccess(projectId: string, userId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const membership = await this.membershipRepo.findOne({
      where: { orgId: project.orgId, userId },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }
    return membership;
  }
}
