import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization, OrgMembership } from '@forgeline/database';
import { OrgRole, slugify } from '@forgeline/common';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrgMembership)
    private readonly membershipRepo: Repository<OrgMembership>,
  ) {}

  async create(userId: string, dto: CreateOrgDto) {
    const org = this.orgRepo.create({
      name: dto.name,
      slug: slugify(dto.name),
    });
    await this.orgRepo.save(org);

    // Creator becomes owner
    const membership = this.membershipRepo.create({
      userId,
      orgId: org.id,
      role: OrgRole.OWNER,
    });
    await this.membershipRepo.save(membership);

    return org;
  }

  async findAllForUser(userId: string) {
    const memberships = await this.membershipRepo.find({
      where: { userId },
      relations: ['organization'],
    });
    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  }

  async findOne(orgId: string, userId: string) {
    await this.assertMembership(orgId, userId);
    return this.orgRepo.findOneOrFail({ where: { id: orgId } });
  }

  async update(orgId: string, userId: string, dto: UpdateOrgDto) {
    const membership = await this.assertMembership(orgId, userId);
    if (membership.role === OrgRole.MEMBER) {
      throw new ForbiddenException('Only admins and owners can update the organization');
    }

    await this.orgRepo.update(orgId, {
      ...(dto.name && { name: dto.name, slug: slugify(dto.name) }),
    });

    return this.orgRepo.findOneOrFail({ where: { id: orgId } });
  }

  async delete(orgId: string, userId: string) {
    const membership = await this.assertMembership(orgId, userId);
    if (membership.role !== OrgRole.OWNER) {
      throw new ForbiddenException('Only owners can delete the organization');
    }
    await this.orgRepo.delete(orgId);
    return { deleted: true };
  }

  async getMembers(orgId: string, userId: string) {
    await this.assertMembership(orgId, userId);
    return this.membershipRepo.find({
      where: { orgId },
      relations: ['user'],
    });
  }

  // ─── Helpers ──────────────────────────────────────
  private async assertMembership(orgId: string, userId: string): Promise<OrgMembership> {
    const membership = await this.membershipRepo.findOne({
      where: { orgId, userId },
    });
    if (!membership) {
      throw new NotFoundException('Organization not found or access denied');
    }
    return membership;
  }
}
