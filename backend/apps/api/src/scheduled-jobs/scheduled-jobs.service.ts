import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ScheduledJob, Queue, Project, OrgMembership } from '@forgeline/database';
import { parseExpression } from 'cron-parser';

@Injectable()
export class ScheduledJobsService {
  constructor(
    @InjectRepository(ScheduledJob)
    private readonly scheduledJobRepo: Repository<ScheduledJob>,
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(OrgMembership)
    private readonly membershipRepo: Repository<OrgMembership>,
  ) {}

  async create(userId: string, dto: {
    queueId: string;
    cronExpression: string;
    name?: string;
    payload?: Record<string, any>;
    timezone?: string;
  }) {
    const queue = await this.queueRepo.findOne({ where: { id: dto.queueId } });
    if (!queue) throw new NotFoundException('Queue not found');
    await this.assertProjectAccess(queue.projectId, userId);

    // Compute next run time from cron expression
    const interval = parseExpression(dto.cronExpression, {
      tz: dto.timezone || 'UTC',
    });
    const nextRunAt = interval.next().toDate();

    const scheduledJob = this.scheduledJobRepo.create({
      queueId: dto.queueId,
      cronExpression: dto.cronExpression,
      name: dto.name || null,
      payload: dto.payload || {},
      timezone: dto.timezone || 'UTC',
      isActive: true,
      nextRunAt,
    });

    return this.scheduledJobRepo.save(scheduledJob);
  }

  async findAll(userId: string, queueId: string) {
    const queue = await this.queueRepo.findOne({ where: { id: queueId } });
    if (!queue) throw new NotFoundException('Queue not found');
    await this.assertProjectAccess(queue.projectId, userId);

    return this.scheduledJobRepo.find({
      where: { queueId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForProject(userId: string, projectId: string) {
    await this.assertProjectAccess(projectId, userId);

    const queues = await this.queueRepo.find({ where: { projectId }, select: ['id'] });
    if (!queues.length) return [];

    return this.scheduledJobRepo.find({
      where: { queueId: In(queues.map(q => q.id)) },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string) {
    const sj = await this.scheduledJobRepo.findOne({
      where: { id },
      relations: ['queue'],
    });
    if (!sj) throw new NotFoundException('Scheduled job not found');
    return sj;
  }

  async activate(userId: string, id: string) {
    const sj = await this.findOne(userId, id);
    const interval = parseExpression(sj.cronExpression, { tz: sj.timezone });
    sj.isActive = true;
    sj.nextRunAt = interval.next().toDate();
    return this.scheduledJobRepo.save(sj);
  }

  async deactivate(userId: string, id: string) {
    const sj = await this.findOne(userId, id);
    sj.isActive = false;
    sj.nextRunAt = null;
    return this.scheduledJobRepo.save(sj);
  }

  async delete(userId: string, id: string) {
    const sj = await this.findOne(userId, id);
    await this.scheduledJobRepo.delete(sj.id);
    return { deleted: true };
  }

  private async assertProjectAccess(projectId: string, userId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const membership = await this.membershipRepo.findOne({
      where: { orgId: project.orgId, userId },
    });
    if (!membership) throw new ForbiddenException('Access denied');
  }
}
