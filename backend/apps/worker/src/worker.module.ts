import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '@forgeline/database';
import {
  Job, JobExecution, JobLog, Queue,
  Worker, WorkerHeartbeat, ScheduledJob,
  DeadLetterEntry, RateLimit,
} from '@forgeline/database';
import { WorkerOrchestratorService } from './orchestrator/orchestrator.service';
import { JobClaimerService } from './claimer/claimer.service';
import { JobExecutorService } from './executor/executor.service';
import { HeartbeatService } from './heartbeat/heartbeat.service';
import { ReaperService } from './reaper/reaper.service';
import { SchedulerService } from './scheduler/scheduler.service';
import { RetryService } from './retry/retry.service';
import { AiSummaryService } from './ai-summary/ai-summary.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([
      Job, JobExecution, JobLog, Queue,
      Worker, WorkerHeartbeat, ScheduledJob,
      DeadLetterEntry, RateLimit,
    ]),
  ],
  providers: [
    WorkerOrchestratorService,
    JobClaimerService,
    JobExecutorService,
    HeartbeatService,
    ReaperService,
    SchedulerService,
    RetryService,
    AiSummaryService,
  ],
})
export class WorkerModule {}
