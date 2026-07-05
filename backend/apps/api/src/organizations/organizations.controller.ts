import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  create(@Request() req: any, @Body() dto: CreateOrgDto) {
    return this.orgService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations for current user' })
  findAll(@Request() req: any) {
    return this.orgService.findAllForUser(req.user.sub);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Request() req: any, @Param('orgId') orgId: string) {
    return this.orgService.findOne(orgId, req.user.sub);
  }

  @Put(':orgId')
  @ApiOperation({ summary: 'Update organization' })
  update(@Request() req: any, @Param('orgId') orgId: string, @Body() dto: UpdateOrgDto) {
    return this.orgService.update(orgId, req.user.sub, dto);
  }

  @Delete(':orgId')
  @ApiOperation({ summary: 'Delete organization (owner only)' })
  delete(@Request() req: any, @Param('orgId') orgId: string) {
    return this.orgService.delete(orgId, req.user.sub);
  }

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List organization members' })
  getMembers(@Request() req: any, @Param('orgId') orgId: string) {
    return this.orgService.getMembers(orgId, req.user.sub);
  }
}
