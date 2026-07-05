import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * CONCURRENCY TEST SUITE
 * ══════════════════════════════════════════════════════════
 *
 * THE highest-scrutiny test: proves that our SKIP LOCKED
 * atomic claiming guarantees exactly-once execution per job,
 * even with 10+ concurrent workers hitting the same queue.
 *
 * Setup:
 * - Creates a test queue with 100 jobs
 * - Spins up N (configurable, default 10) simulated "workers"
 *   that all poll concurrently using the same claim query
 * - Each worker claims and "processes" jobs atomically
 *
 * Assertions:
 * - Every job is claimed exactly once (zero duplicates)
 * - All 100 jobs eventually get claimed
 * - Total claimed === total jobs
 * - No two workers share the same job ID
 *
 * This test requires a running PostgreSQL instance.
 * Run: npm run test:concurrency
 */

const DB_CONFIG = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'forgeline',
  password: process.env.DB_PASSWORD || 'forgeline_secret',
  database: process.env.DB_DATABASE || 'forgeline',
};

const NUM_WORKERS = 10;
const NUM_JOBS = 100;

describe('Atomic Job Claiming — Concurrency Test', () => {
  let dataSource: DataSource;
  let testQueueId: string;
  let testProjectId: string;
  let testOrgId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      ...DB_CONFIG,
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();

    // Create test fixtures
    testOrgId = uuidv4();
    testProjectId = uuidv4();
    testQueueId = uuidv4();

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [testOrgId, 'Concurrency Test Org', 'concurrency-test-org'],
    );

    await dataSource.query(
      `INSERT INTO projects (id, org_id, name, slug) VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT "uq_project_org_slug" DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [testProjectId, testOrgId, 'Concurrency Test', 'concurrency-test'],
    );

    await dataSource.query(
      `INSERT INTO queues (id, project_id, name, slug, concurrency_limit, is_paused)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ON CONSTRAINT "uq_queue_project_slug" DO UPDATE
       SET concurrency_limit = EXCLUDED.concurrency_limit, is_paused = EXCLUDED.is_paused
       RETURNING id`,
      [testQueueId, testProjectId, 'Test Queue', 'test-queue', 100, false],
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await dataSource.query(`DELETE FROM jobs WHERE queue_id = $1`, [testQueueId]);
    await dataSource.query(`DELETE FROM queues WHERE id = $1`, [testQueueId]);
    await dataSource.query(`DELETE FROM projects WHERE id = $1`, [testProjectId]);
    await dataSource.query(`DELETE FROM organizations WHERE id = $1`, [testOrgId]);
    await dataSource.destroy();
  });

  it(`should claim exactly ${NUM_JOBS} jobs across ${NUM_WORKERS} concurrent workers with ZERO duplicates`, async () => {
    // ─── Step 1: Insert test jobs ───────────────────
    const jobIds: string[] = [];
    for (let i = 0; i < NUM_JOBS; i++) {
      const jobId = uuidv4();
      jobIds.push(jobId);
      await dataSource.query(
        `INSERT INTO jobs (id, queue_id, type, status, priority, payload)
         VALUES ($1, $2, 'immediate', 'queued', $3, $4)`,
        [jobId, testQueueId, Math.floor(Math.random() * 10), JSON.stringify({ index: i })],
      );
    }

    expect(jobIds.length).toBe(NUM_JOBS);

    // ─── Step 2: Register simulated workers ─────────
    const workerIds: string[] = [];
    for (let i = 0; i < NUM_WORKERS; i++) {
      const workerId = uuidv4();
      workerIds.push(workerId);
      await dataSource.query(
        `INSERT INTO workers (id, name, status, max_concurrency, current_load, registered_at, last_heartbeat_at)
         VALUES ($1, $2, 'online', 10, 0, NOW(), NOW())`,
        [workerId, `test-worker-${i}`],
      );
    }

    // ─── Step 3: All workers claim concurrently ─────
    // This is the critical test: all workers fire the claim query
    // at the same time. SKIP LOCKED must ensure no duplicates.
    const claimResults = await Promise.all(
      workerIds.map((workerId) => claimJobsAtomic(dataSource, workerId, 20)),
    );

    // ─── Step 4: Collect results ────────────────────
    const allClaimed: string[] = [];
    const claimsByWorker: Record<string, string[]> = {};

    for (let i = 0; i < workerIds.length; i++) {
      const claimed = claimResults[i];
      claimsByWorker[workerIds[i]] = claimed.map((j: any) => j.id);
      allClaimed.push(...claimed.map((j: any) => j.id));
    }

    // ─── Step 5: Assertions ─────────────────────────
    // 5a: Total claimed should equal total jobs
    expect(allClaimed.length).toBe(NUM_JOBS);

    // 5b: No duplicates — every job claimed exactly once
    const uniqueClaimed = new Set(allClaimed);
    expect(uniqueClaimed.size).toBe(NUM_JOBS);

    // 5c: Every original job ID should be in the claimed set
    for (const jobId of jobIds) {
      expect(uniqueClaimed.has(jobId)).toBe(true);
    }

    // 5d: Multiple workers should have claimed jobs (work distribution)
    const workersWithJobs = Object.values(claimsByWorker).filter((jobs) => jobs.length > 0);
    expect(workersWithJobs.length).toBeGreaterThan(1);

    // 5e: Verify in database — all jobs should be 'claimed' status
    const dbCheck = await dataSource.query(
      `SELECT COUNT(*) as count FROM jobs WHERE queue_id = $1 AND status = 'claimed'`,
      [testQueueId],
    );
    expect(parseInt(dbCheck[0].count, 10)).toBe(NUM_JOBS);

    // ─── Report ─────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('  CONCURRENCY TEST RESULTS');
    console.log('═══════════════════════════════════════════');
    console.log(`  Workers:        ${NUM_WORKERS}`);
    console.log(`  Total Jobs:     ${NUM_JOBS}`);
    console.log(`  Total Claimed:  ${allClaimed.length}`);
    console.log(`  Unique Claimed: ${uniqueClaimed.size}`);
    console.log(`  Duplicates:     ${allClaimed.length - uniqueClaimed.size}`);
    console.log('───────────────────────────────────────────');
    for (const [wid, jobs] of Object.entries(claimsByWorker)) {
      console.log(`  Worker ${wid.substring(0, 8)}: ${jobs.length} jobs`);
    }
    console.log('═══════════════════════════════════════════\n');

    // Cleanup workers
    for (const wid of workerIds) {
      await dataSource.query(`DELETE FROM workers WHERE id = $1`, [wid]);
    }
  });
});

/**
 * The exact claim query used by the worker — replicated here for testing.
 * Uses CTE with FOR UPDATE SKIP LOCKED for atomic claiming.
 */
async function claimJobsAtomic(
  ds: DataSource,
  workerId: string,
  limit: number,
): Promise<any[]> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction('READ COMMITTED');

  try {
    const result = await qr.query(
      `
      WITH eligible_queues AS (
        SELECT q.id AS queue_id, q.concurrency_limit
        FROM queues q
        WHERE q.is_paused = false
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

    await qr.commitTransaction();
    // TypeORM returns [rows, rowCount] for UPDATE...RETURNING
    const rows = Array.isArray(result) && Array.isArray(result[0])
      ? result[0]
      : result || [];
    return rows;
  } catch (error) {
    await qr.rollbackTransaction();
    throw error;
  } finally {
    await qr.release();
  }
}
