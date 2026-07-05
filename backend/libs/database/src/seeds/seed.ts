import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed script: creates demo user, org, project, queues, retry policies,
 * and sample jobs for local development.
 *
 * Usage: npm run seed
 */
async function seed() {
  console.log('🔥 Forgeline Seed Script');
  console.log('────────────────────────────────────────');

  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('✅ Database connected');

  const qr = ds.createQueryRunner();

  try {
    // ─── Create demo user ───────────────────────────
    const passwordHash = await bcrypt.hash('forgeline123', 12);
    const existingUser = await qr.query('SELECT id FROM users WHERE email = $1', ['demo@forgeline.dev']);
    let userId = existingUser.length ? existingUser[0].id : uuidv4();

    if (!existingUser.length) {
      await qr.query(
        `INSERT INTO users (id, email, password_hash, name)
         VALUES ($1, $2, $3, $4)`,
        [userId, 'demo@forgeline.dev', passwordHash, 'Demo User'],
      );
    } else {
      // Update password hash just in case
      await qr.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, userId]
      );
    }
    console.log('✅ Demo user: demo@forgeline.dev / forgeline123');

    const existingOrg = await qr.query('SELECT id FROM organizations WHERE slug = $1', ['forgeline-demo']);
    let orgId = existingOrg.length ? existingOrg[0].id : uuidv4();

    if (!existingOrg.length) {
      await qr.query(
        `INSERT INTO organizations (id, name, slug)
         VALUES ($1, $2, $3)`,
        [orgId, 'Forgeline Demo', 'forgeline-demo'],
      );
    }
    console.log('✅ Organization: Forgeline Demo');

    // ─── Create membership ──────────────────────────
    await qr.query(
      `INSERT INTO org_memberships (id, user_id, org_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT "uq_org_membership" DO NOTHING`,
      [uuidv4(), userId, orgId, 'owner'],
    );

    const existingProject = await qr.query('SELECT id FROM projects WHERE org_id = $1 AND slug = $2', [orgId, 'production-pipeline']);
    let projectId = existingProject.length ? existingProject[0].id : uuidv4();

    if (!existingProject.length) {
      await qr.query(
        `INSERT INTO projects (id, org_id, name, slug)
         VALUES ($1, $2, $3, $4)`,
        [projectId, orgId, 'Production Pipeline', 'production-pipeline'],
      );
    }
    console.log('✅ Project: Production Pipeline');

    // ─── Create retry policies ──────────────────────
    const retryPolicyExp = uuidv4();
    const retryPolicyFixed = uuidv4();
    await qr.query(
      `INSERT INTO retry_policies (id, project_id, name, strategy, max_retries, base_delay_ms, max_delay_ms, jitter)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [retryPolicyExp, projectId, 'Exponential Backoff', 'exponential', 5, 1000, 300000, true],
    );
    await qr.query(
      `INSERT INTO retry_policies (id, project_id, name, strategy, max_retries, base_delay_ms, max_delay_ms, jitter)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [retryPolicyFixed, projectId, 'Fixed Retry', 'fixed', 3, 5000, 5000, false],
    );
    console.log('✅ Retry policies: Exponential Backoff, Fixed Retry');

    // ─── Create queues ──────────────────────────────
    const queues = [
      { name: 'Email Dispatch', slug: 'email-dispatch', priority: 10, concurrency: 5, retryPolicy: retryPolicyExp },
      { name: 'Report Generation', slug: 'report-generation', priority: 5, concurrency: 3, retryPolicy: retryPolicyExp },
      { name: 'Data Sync', slug: 'data-sync', priority: 8, concurrency: 8, retryPolicy: retryPolicyFixed },
      { name: 'Webhook Delivery', slug: 'webhook-delivery', priority: 15, concurrency: 10, retryPolicy: retryPolicyExp },
      { name: 'Image Processing', slug: 'image-processing', priority: 3, concurrency: 2, retryPolicy: retryPolicyFixed },
    ];

    const queueIds: string[] = [];
    for (const q of queues) {
      const existingQueue = await qr.query('SELECT id FROM queues WHERE project_id = $1 AND slug = $2', [projectId, q.slug]);
      let queueId = existingQueue.length ? existingQueue[0].id : uuidv4();
      queueIds.push(queueId);

      if (!existingQueue.length) {
        await qr.query(
          `INSERT INTO queues (id, project_id, name, slug, priority, concurrency_limit, retry_policy_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [queueId, projectId, q.name, q.slug, q.priority, q.concurrency, q.retryPolicy],
        );
      }
    }
    console.log(`✅ Queues: ${queues.map((q) => q.name).join(', ')}`);

    // ─── Create sample jobs ─────────────────────────
    const statuses = ['queued', 'completed', 'failed', 'running'];
    const jobTypes = ['immediate', 'delayed', 'scheduled'];
    let jobCount = 0;

    for (const queueId of queueIds) {
      for (let i = 0; i < 10; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const type = jobTypes[Math.floor(Math.random() * jobTypes.length)];
        const priority = Math.floor(Math.random() * 20);

        await qr.query(
          `INSERT INTO jobs (id, queue_id, type, status, priority, payload, attempt, max_retries, retry_strategy, retry_delay_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            uuidv4(),
            queueId,
            type,
            status,
            priority,
            JSON.stringify({
              task: `sample-task-${i}`,
              data: { index: i, timestamp: new Date().toISOString() },
            }),
            status === 'completed' ? 1 : 0,
            3,
            'exponential',
            1000,
          ],
        );
        jobCount++;
      }
    }
    console.log(`✅ Created ${jobCount} sample jobs across ${queueIds.length} queues`);

    // ─── Create a scheduled job (cron) ──────────────
    await qr.query(
      `INSERT INTO scheduled_jobs (id, queue_id, cron_expression, name, payload, is_active, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        queueIds[0],
        '*/5 * * * *',
        'Periodic Health Check',
        JSON.stringify({ type: 'health-check', target: 'all-services' }),
        true,
        new Date(Date.now() + 5 * 60 * 1000),
      ],
    );
    console.log('✅ Scheduled job: Periodic Health Check (every 5 min)');

    console.log('────────────────────────────────────────');
    console.log('🔥 Seed complete!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

seed();
