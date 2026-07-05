import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeadLetterEntry, Job, Queue, Project, OrgMembership, JobLog } from '@forgeline/database';
import { DlqService } from './dlq.service';
import { DlqController } from './dlq.controller';
import { AuthModule } from '../auth/auth.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeadLetterEntry, Job, Queue, Project, OrgMembership, JobLog]),
    AuthModule,
    GatewayModule,
  ],
  controllers: [DlqController],
  providers: [DlqService],
  exports: [DlqService],
})
export class DlqModule {}
