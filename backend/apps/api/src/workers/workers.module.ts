import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker, WorkerHeartbeat } from '@forgeline/database';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, WorkerHeartbeat]),
    AuthModule,
  ],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
