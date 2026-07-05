import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, OrgMembership, RetryPolicy } from '@forgeline/database';
import { slugify } from '@forgeline/common';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(OrgMembership)
    private readonly membershipRepo: Repository<OrgMembership>,
    @InjectRepository(RetryPolicy)
    private readonly retryPolicyRepo: Repository<RetryPolicy>,
  ) {}

  async create(userId: string, orgId: string, dto: { name: string }) {
    await this.assertOrgAccess(orgId, userId);
    const project = this.projectRepo.create({
      orgId,
      name: dto.name,
      slug: slugify(dto.name),
    });
    return this.projectRepo.save(project);
  }

  async findAllForOrg(userId: string, orgId: string) {
    await this.assertOrgAccess(orgId, userId);
    return this.projectRepo.find({
      where: { orgId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['queues', 'retryPolicies'],
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.assertOrgAccess(project.orgId, userId);
    return project;
  }

  async update(userId: string, projectId: string, dto: { name?: string }) {
    const project = await this.findOne(userId, projectId);
    if (dto.name) {
      project.name = dto.name;
      project.slug = slugify(dto.name);
    }
    return this.projectRepo.save(project);
  }

  async delete(userId: string, projectId: string) {
    const project = await this.findOne(userId, projectId);
    await this.projectRepo.delete(project.id);
    return { deleted: true };
  }

  // ─── Retry Policies ─────────────────────────────
  async createRetryPolicy(userId: string, projectId: string, dto: any) {
    await this.findOne(userId, projectId);
    const policy = this.retryPolicyRepo.create({ ...dto, projectId });
    return this.retryPolicyRepo.save(policy);
  }

  async getRetryPolicies(userId: string, projectId: string) {
    await this.findOne(userId, projectId);
    return this.retryPolicyRepo.find({ where: { projectId } });
  }

  // ─── Helpers ────────────────────────────────────
  private async assertOrgAccess(orgId: string, userId: string) {
    const membership = await this.membershipRepo.findOne({
      where: { orgId, userId },
    });
    if (!membership) {
      throw new ForbiddenException('Organization access denied');
    }
    return membership;
  }
}
