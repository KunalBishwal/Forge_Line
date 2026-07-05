import {
  Controller, Get, Post, Delete,
  Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DlqService } from './dlq.service';

@ApiTags('Dead Letter Queue')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('dlq')
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get()
  @ApiOperation({ summary: 'List DLQ entries with optional queue filter' })
  findAll(
    @Query('queueId') queueId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dlqService.findAll({ queueId, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get DLQ entry details' })
  findOne(@Param('id') id: string) {
    return this.dlqService.findOne(id);
  }

  @Post(':id/replay')
  @ApiOperation({ summary: 'Replay from DLQ — creates a new job from original payload' })
  replay(@Param('id') id: string) {
    return this.dlqService.replay(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Discard a DLQ entry' })
  discard(@Param('id') id: string) {
    return this.dlqService.discard(id);
  }
}
