import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledJob, Queue, Project, OrgMembership } from '@forgeline/database';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { ScheduledJobsController } from './scheduled-jobs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledJob, Queue, Project, OrgMembership]),
    AuthModule,
  ],
  controllers: [ScheduledJobsController],
  providers: [ScheduledJobsService],
  exports: [ScheduledJobsService],
})
export class ScheduledJobsModule {}
