import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueuesService } from './queues.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';

@ApiTags('Queues')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new queue in a project' })
  create(@Request() req: any, @Param('projectId') projectId: string, @Body() dto: CreateQueueDto) {
    return this.queuesService.create(req.user.sub, projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all queues with live stats' })
  findAll(@Request() req: any, @Param('projectId') projectId: string) {
    return this.queuesService.findAllForProject(req.user.sub, projectId);
  }

  @Get(':queueId')
  @ApiOperation({ summary: 'Get queue details with config and stats' })
  findOne(@Request() req: any, @Param('queueId') queueId: string) {
    return this.queuesService.findOne(req.user.sub, queueId);
  }

  @Put(':queueId')
  @ApiOperation({ summary: 'Update queue configuration' })
  update(@Request() req: any, @Param('queueId') queueId: string, @Body() dto: UpdateQueueDto) {
    return this.queuesService.update(req.user.sub, queueId, dto);
  }

  @Patch(':queueId/pause')
  @ApiOperation({ summary: 'Pause queue — stops claiming new jobs' })
  pause(@Request() req: any, @Param('queueId') queueId: string) {
    return this.queuesService.pause(req.user.sub, queueId);
  }

  @Patch(':queueId/resume')
  @ApiOperation({ summary: 'Resume queue — allows job claiming again' })
  resume(@Request() req: any, @Param('queueId') queueId: string) {
    return this.queuesService.resume(req.user.sub, queueId);
  }

  @Get(':queueId/stats')
  @ApiOperation({ summary: 'Get live queue statistics' })
  getStats(@Request() req: any, @Param('queueId') queueId: string) {
    return this.queuesService.getStats(req.user.sub, queueId);
  }

  @Delete(':queueId')
  @ApiOperation({ summary: 'Delete a queue and all its jobs' })
  delete(@Request() req: any, @Param('queueId') queueId: string) {
    return this.queuesService.delete(req.user.sub, queueId);
  }
}
