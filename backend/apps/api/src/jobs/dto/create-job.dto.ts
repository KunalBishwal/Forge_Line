import {
  IsString, IsInt, IsOptional, IsUUID, IsEnum, IsObject,
  IsNumber, IsDateString, Min, Max, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType, RetryStrategy } from '@forgeline/common';

export class CreateJobDto {
  @ApiProperty({ description: 'Target queue ID' })
  @IsUUID()
  queueId: string;

  @ApiPropertyOptional({ description: 'Idempotency key for deduplication' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiPropertyOptional({ enum: JobType, default: JobType.IMMEDIATE })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ description: 'Job priority (higher = first)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ description: 'Job payload data', default: {} })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Delay in ms (for delayed jobs)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delayMs?: number;

  @ApiPropertyOptional({ description: 'ISO date string (for scheduled jobs)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Override max retries' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxRetries?: number;

  @ApiPropertyOptional({ enum: RetryStrategy })
  @IsOptional()
  @IsEnum(RetryStrategy)
  retryStrategy?: RetryStrategy;

  @ApiPropertyOptional({ description: 'Override base retry delay in ms' })
  @IsOptional()
  @IsInt()
  @Min(100)
  retryDelayMs?: number;
}
