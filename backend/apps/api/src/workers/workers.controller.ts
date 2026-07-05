import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkersService } from './workers.service';

@ApiTags('Workers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered workers' })
  findAll() {
    return this.workersService.findAll();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get overall worker health summary' })
  getHealthSummary() {
    return this.workersService.getHealthSummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get worker details' })
  findOne(@Param('id') id: string) {
    return this.workersService.findOne(id);
  }

  @Get(':id/heartbeats')
  @ApiOperation({ summary: 'Get recent heartbeats for a worker' })
  getHeartbeats(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.workersService.getHeartbeats(id, limit);
  }
}
