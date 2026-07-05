import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('organizations/:orgId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project within an organization' })
  create(@Request() req: any, @Param('orgId') orgId: string, @Body() dto: { name: string }) {
    return this.projectsService.create(req.user.sub, orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects in an organization' })
  findAll(@Request() req: any, @Param('orgId') orgId: string) {
    return this.projectsService.findAllForOrg(req.user.sub, orgId);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details with queues and policies' })
  findOne(@Request() req: any, @Param('projectId') projectId: string) {
    return this.projectsService.findOne(req.user.sub, projectId);
  }

  @Put(':projectId')
  @ApiOperation({ summary: 'Update a project' })
  update(@Request() req: any, @Param('projectId') projectId: string, @Body() dto: { name?: string }) {
    return this.projectsService.update(req.user.sub, projectId, dto);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete a project and all its queues/jobs' })
  delete(@Request() req: any, @Param('projectId') projectId: string) {
    return this.projectsService.delete(req.user.sub, projectId);
  }

  @Post(':projectId/retry-policies')
  @ApiOperation({ summary: 'Create a retry policy for the project' })
  createRetryPolicy(@Request() req: any, @Param('projectId') projectId: string, @Body() dto: any) {
    return this.projectsService.createRetryPolicy(req.user.sub, projectId, dto);
  }

  @Get(':projectId/retry-policies')
  @ApiOperation({ summary: 'List retry policies for the project' })
  getRetryPolicies(@Request() req: any, @Param('projectId') projectId: string) {
    return this.projectsService.getRetryPolicies(req.user.sub, projectId);
  }
}
