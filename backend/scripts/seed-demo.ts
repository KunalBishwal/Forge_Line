import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../libs/database/src/data-source';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed script: creates demo user, org, project, queues, retry policies,
 * realistic workers, jobs in various statuses, and DLQ entries.
 *
 * Usage: npx ts-node scripts/seed-demo.ts
 */
async function seed() {
  console.log('🔥 Forgeline Realistic Demo Seed Script');
  console.log('────────────────────────────────────────');

  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('✅ Database connected');

  const qr = ds.createQueryRunner();

  try {
    // ─── Create demo user ───────────────────────────
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash('forgeline123', 12);
    await qr.query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [userId, 'demo@forgeline.dev', passwordHash, 'Demo User'],
    );
    // Get actual user ID in case it existed
    const userResult = await qr.query(`SELECT id FROM users WHERE email = 'demo@forgeline.dev'`);
    const actualUserId = userResult[0].id;
    console.log('✅ Demo user: demo@forgeline.dev');

    // ─── Create organization ────────────────────────
    const orgId = uuidv4();
    await qr.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [orgId, 'Forgeline Demo', 'forgeline-demo'],
    );
    const orgResult = await qr.query(`SELECT id FROM organizations WHERE slug = 'forgeline-demo'`);
    const actualOrgId = orgResult[0].id;
    console.log('✅ Organization: Forgeline Demo');

    // ─── Create membership ──────────────────────────
    await qr.query(
      `INSERT INTO org_memberships (id, user_id, org_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT "uq_org_membership" DO NOTHING`,
      [uuidv4(), actualUserId, actualOrgId, 'owner'],
    );

    // ─── Create project ─────────────────────────────
    const projectId = uuidv4();
    await qr.query(
      `INSERT INTO projects (id, org_id, name, slug)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT "uq_project_org_slug" DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [projectId, actualOrgId, 'Production Pipeline', 'production-pipeline'],
    );
    const projectResult = await qr.query(`SELECT id FROM projects WHERE slug = 'production-pipeline' AND org_id = $1`, [actualOrgId]);
    const actualProjectId = projectResult[0].id;
    console.log('✅ Project: Production Pipeline');

    // ─── Clear existing data ────────────────────────
    await qr.query(`DELETE FROM dead_letter_queue`);
    await qr.query(`DELETE FROM job_logs`);
    await qr.query(`DELETE FROM job_executions`);
    await qr.query(`DELETE FROM jobs`);
    await qr.query(`DELETE FROM worker_heartbeats`);
    await qr.query(`DELETE FROM workers`);
    console.log('✅ Cleared old jobs and workers');

    // ─── Create queues ──────────────────────────────
    const queuesResult = await qr.query(`SELECT id FROM queues WHERE project_id = $1 LIMIT 1`, [actualProjectId]);
    let queueId = queuesResult.length > 0 ? queuesResult[0].id : null;
    
    if (!queueId) {
       queueId = uuidv4();
       await qr.query(
         `INSERT INTO queues (id, project_id, name, slug, priority, concurrency_limit)
          VALUES ($1, $2, $3, $4, $5, $6)`,
         [queueId, actualProjectId, 'Main Processing', 'main-processing', 10, 10],
       );
    }

    // ─── Create distinct workers ────────────────────
    const workers = [
      { name: 'forge-node-alpha', status: 'online', load: 8, max: 10, mem: 420, cpu: 34, ago: 2000 },
      { name: 'forge-node-beta', status: 'online', load: 4, max: 10, mem: 310, cpu: 18, ago: 5000 },
      { name: 'forge-node-gamma', status: 'draining', load: 2, max: 5, mem: 550, cpu: 12, ago: 12000 },
      { name: 'forge-node-delta', status: 'offline', load: 0, max: 10, mem: 0, cpu: 0, ago: 180000 },
    ];

    const workerIds = [];
    for (const w of workers) {
      const wId = uuidv4();
      workerIds.push({ id: wId, ...w });
      
      const lastHeartbeat = new Date(Date.now() - w.ago);
      
      await qr.query(
        `INSERT INTO workers (id, name, status, max_concurrency, current_load, registered_at, last_heartbeat_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [wId, w.name, w.status, w.max, w.load, new Date(Date.now() - 3600000), lastHeartbeat]
      );

      // Create a few heartbeats for history
      if (w.status !== 'offline') {
        for(let i=0; i<5; i++) {
          await qr.query(
            `INSERT INTO worker_heartbeats (id, worker_id, memory_mb, cpu_percent, load)
             VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), wId, Math.round(w.mem + (Math.random()*20-10)), Math.round(w.cpu + (Math.random()*5)), w.load]
          );
        }
      }
    }
    console.log('✅ Created 4 distinct workers');

    // ─── Create realistic jobs ──────────────────────
    const jobTypes = ['immediate', 'delayed'];
    let jobCount = 0;

    // 5 Queued
    for(let i=0; i<5; i++) {
      await qr.query(
        `INSERT INTO jobs (id, queue_id, type, status, priority, payload, attempt, max_retries, retry_strategy)
         VALUES ($1, $2, $3, 'queued', $4, $5, 0, 3, 'exponential')`,
        [uuidv4(), queueId, jobTypes[Math.floor(Math.random()*jobTypes.length)], Math.floor(Math.random()*20), JSON.stringify({ task: 'process-image', id: i })]
      );
      jobCount++;
    }

    // 12 Running (assigned to workers)
    for(let i=0; i<12; i++) {
      const worker = workerIds[i % 3]; // Assign to online/draining workers
      await qr.query(
        `INSERT INTO jobs (id, queue_id, type, status, priority, payload, attempt, max_retries, retry_strategy, claimed_by, started_at)
         VALUES ($1, $2, 'immediate', 'running', 10, $3, 1, 3, 'exponential', $4, $5)`,
        [uuidv4(), queueId, JSON.stringify({ task: 'generate-report', id: i }), worker.id, new Date(Date.now() - Math.random() * 60000)]
      );
      jobCount++;
    }

    // 25 Completed (recent so throughput shows up)
    for(let i=0; i<25; i++) {
      // spread over the last 60 seconds
      const completedAt = new Date(Date.now() - (Math.random() * 60000));
      await qr.query(
        `INSERT INTO jobs (id, queue_id, type, status, priority, payload, attempt, max_retries, retry_strategy, started_at, completed_at, result)
         VALUES ($1, $2, 'immediate', 'completed', 5, $3, 1, 3, 'exponential', $4, $5, $6)`,
        [
          uuidv4(), queueId, JSON.stringify({ task: 'send-email', id: i }), 
          new Date(completedAt.getTime() - 2000), completedAt, 
          JSON.stringify({ success: true, message: 'Delivered' })
        ]
      );
      jobCount++;
    }

    // 3 Failed (ready for retry)
    for(let i=0; i<3; i++) {
      await qr.query(
        `INSERT INTO jobs (id, queue_id, type, status, priority, payload, attempt, max_retries, retry_strategy, error)
         VALUES ($1, $2, 'immediate', 'failed', 15, $3, 1, 3, 'exponential', $4)`,
        [uuidv4(), queueId, JSON.stringify({ task: 'sync-data', id: i }), 'Connection timeout to remote API']
      );
      jobCount++;
    }

    // 5 Dead Letter (failed 3 times)
    for(let i=0; i<5; i++) {
      const jobId = uuidv4();
      const payload = JSON.stringify({ task: 'webhook-delivery', target: 'https://api.example.com' });
      const errorMsg = 'HTTP 502 Bad Gateway';
      
      await qr.query(
        `INSERT INTO jobs (id, queue_id, type, status, priority, payload, attempt, max_retries, retry_strategy, error)
         VALUES ($1, $2, 'immediate', 'dead_letter', 20, $3, 3, 3, 'exponential', $4)`,
        [jobId, queueId, payload, errorMsg]
      );

      await qr.query(
        `INSERT INTO dead_letter_queue (id, original_job_id, queue_id, payload, error, attempts, failed_at)
         VALUES ($1, $2, $3, $4, $5, 3, $6)`,
        [uuidv4(), jobId, queueId, payload, errorMsg, new Date(Date.now() - 3600000)]
      );
      jobCount++;
    }

    console.log(`✅ Created ${jobCount} realistic demo jobs`);
    console.log('────────────────────────────────────────');
    console.log('🔥 Demo Seed complete!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

seed();
