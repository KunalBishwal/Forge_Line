import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@forgeline/database';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { QueuesModule } from './queues/queues.module';
import { JobsModule } from './jobs/jobs.module';
import { ScheduledJobsModule } from './scheduled-jobs/scheduled-jobs.module';
import { DlqModule } from './dlq/dlq.module';
import { WorkersModule } from './workers/workers.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    // Global config — loads .env from project root
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),

    // Shared database connection
    DatabaseModule,

    // Feature modules
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    QueuesModule,
    JobsModule,
    ScheduledJobsModule,
    DlqModule,
    WorkersModule,
    GatewayModule,
  ],
})
export class AppModule {}
