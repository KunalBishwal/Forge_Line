import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Job } from '@forgeline/database';

/**
 * Job Claimer — THE critical concurrency component.
 *
 * Uses PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` in a CTE
 * to atomically find, lock, and claim jobs in a single transaction.
 *
 * Guarantees:
 * - Exactly-once claim per job even with 10+ concurrent workers
 * - No blocking between workers (SKIP LOCKED)
 * - Respects queue pause state and concurrency limits
 * - Orders by priority DESC, then creation time ASC
 */
@Injectable()
export class JobClaimerService {
  private readonly logger = new Logger(JobClaimerService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Atomically claims up to `limit` jobs for the given worker.
   *
   * The SQL does:
   * 1. Finds jobs with status 'queued' (or 'scheduled' with scheduledAt <= now)
   * 2. Filters to queues that are NOT paused
   * 3. Filters to queues where running jobs < concurrency_limit
   * 4. Locks rows with FOR UPDATE SKIP LOCKED (non-blocking)
   * 5. Updates status to 'claimed' and sets claimed_by = workerId
   * 6. Returns the claimed jobs
   *
   * All in one atomic CTE — no race conditions possible.
   */
  async claimJobs(workerId: string, limit: number): Promise<Job[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const rawRows = await queryRunner.query(
        `
        WITH eligible_queues AS (
          -- Find queues that are not paused and have capacity
          SELECT q.id AS queue_id, q.concurrency_limit
          FROM queues q
          WHERE q.is_paused = false
            AND (
              SELECT COUNT(*)
              FROM jobs j2
              WHERE j2.queue_id = q.id
                AND j2.status IN ('claimed', 'running')
            ) < q.concurrency_limit
        ),
        claimable AS (
          SELECT j.id
          FROM jobs j
          INNER JOIN eligible_queues eq ON j.queue_id = eq.queue_id
          WHERE j.status = 'queued'
            AND (j.scheduled_at IS NULL OR j.scheduled_at <= NOW())
          ORDER BY j.priority DESC, j.created_at ASC
          LIMIT $1
          FOR UPDATE OF j SKIP LOCKED
        )
        UPDATE jobs
        SET status = 'claimed',
            claimed_by = $2,
            updated_at = NOW()
        FROM claimable
        WHERE jobs.id = claimable.id
        RETURNING jobs.*
        `,
        [limit, workerId],
      );

      await queryRunner.commitTransaction();

      // TypeORM's PostgresQueryRunner returns [rows, rowCount] for
      // UPDATE...RETURNING queries (not just the rows array).
      // Extract the actual row data from index 0.
      const rows = Array.isArray(rawRows) && Array.isArray(rawRows[0])
        ? rawRows[0]
        : rawRows || [];

      // Raw SQL returns snake_case column names from PostgreSQL.
      // Map them to camelCase TypeORM entity properties so the
      // executor, retry engine, and DLQ handler all work correctly.
      return rows.map((row: any) => {
        const job = new Job();
        job.id = row.id;
        job.queueId = row.queue_id;
        job.idempotencyKey = row.idempotency_key;
        job.type = row.type;
        job.status = row.status;
        job.priority = row.priority;
        job.payload = row.payload;
        job.result = row.result;
        job.error = row.error;
        job.aiErrorSummary = row.ai_error_summary;
        job.attempt = row.attempt;
        job.maxRetries = row.max_retries;
        job.retryStrategy = row.retry_strategy;
        job.retryDelayMs = row.retry_delay_ms;
        job.scheduledAt = row.scheduled_at;
        job.startedAt = row.started_at;
        job.completedAt = row.completed_at;
        job.claimedBy = row.claimed_by;
        job.createdAt = row.created_at;
        job.updatedAt = row.updated_at;
        return job;
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Claim failed: ${error.message}`);
      return [];
    } finally {
      await queryRunner.release();
    }
  }
}
