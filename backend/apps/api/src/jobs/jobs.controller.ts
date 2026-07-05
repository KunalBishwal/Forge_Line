import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobFilterDto } from './dto/job-filter.dto';

@ApiTags('Jobs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new job (supports idempotency keys)' })
  create(@Request() req: any, @Body() dto: CreateJobDto) {
    return this.jobsService.create(req.user.sub, dto);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Create multiple jobs in a batch (max 100)' })
  createBatch(@Request() req: any, @Body() dto: CreateJobDto[]) {
    return this.jobsService.createBatch(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs with filters, search, and pagination' })
  findAll(@Request() req: any, @Query() filters: JobFilterDto) {
    return this.jobsService.findAll(req.user.sub, filters);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get job details with execution history and logs' })
  findOne(@Request() req: any, @Param('jobId') jobId: string) {
    return this.jobsService.findOne(req.user.sub, jobId);
  }

  @Patch(':jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed/cancelled job' })
  retry(@Request() req: any, @Param('jobId') jobId: string) {
    return this.jobsService.retry(req.user.sub, jobId);
  }

  @Patch(':jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a queued/scheduled job' })
  cancel(@Request() req: any, @Param('jobId') jobId: string) {
    return this.jobsService.cancel(req.user.sub, jobId);
  }
}
