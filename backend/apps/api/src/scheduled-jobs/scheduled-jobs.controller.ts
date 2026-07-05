import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScheduledJobsService } from './scheduled-jobs.service';

@ApiTags('Scheduled Jobs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('scheduled-jobs')
export class ScheduledJobsController {
  constructor(private readonly service: ScheduledJobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring/cron job definition' })
  create(@Request() req: any, @Body() dto: any) {
    return this.service.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List scheduled jobs for a project or queue' })
  findAll(@Request() req: any, @Query('projectId') projectId: string, @Query('queueId') queueId: string) {
    if (projectId) return this.service.findAllForProject(req.user.sub, projectId);
    return this.service.findAll(req.user.sub, queueId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled job details' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.sub, id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a scheduled job' })
  activate(@Request() req: any, @Param('id') id: string) {
    return this.service.activate(req.user.sub, id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a scheduled job' })
  deactivate(@Request() req: any, @Param('id') id: string) {
    return this.service.deactivate(req.user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a scheduled job' })
  delete(@Request() req: any, @Param('id') id: string) {
    return this.service.delete(req.user.sub, id);
  }
}
