import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue, Job, Project, OrgMembership } from '@forgeline/database';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { AuthModule } from '../auth/auth.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Queue, Job, Project, OrgMembership]),
    AuthModule,
    GatewayModule,
  ],
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
