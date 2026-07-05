import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Job, JobExecution, JobLog, Queue,
  DeadLetterEntry, Project, OrgMembership,
} from '@forgeline/database';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { AuthModule } from '../auth/auth.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job, JobExecution, JobLog, Queue,
      DeadLetterEntry, Project, OrgMembership,
    ]),
    AuthModule,
    forwardRef(() => GatewayModule),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
