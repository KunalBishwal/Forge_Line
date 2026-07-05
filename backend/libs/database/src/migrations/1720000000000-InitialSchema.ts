import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration for Forgeline.
 * Creates all core tables, indexes, enums, and constraints.
 */
export class InitialSchema1720000000000 implements MigrationInterface {
  name = 'InitialSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Create Enum Types ────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "org_role_enum" AS ENUM ('owner', 'admin', 'member')
    `);
    await queryRunner.query(`
      CREATE TYPE "job_status_enum" AS ENUM (
        'queued', 'scheduled', 'claimed', 'running',
        'completed', 'failed', 'dead_letter', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "job_type_enum" AS ENUM (
        'immediate', 'delayed', 'scheduled', 'recurring', 'batch'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "retry_strategy_enum" AS ENUM ('fixed', 'linear', 'exponential')
    `);
    await queryRunner.query(`
      CREATE TYPE "worker_status_enum" AS ENUM ('online', 'draining', 'offline')
    `);
    await queryRunner.query(`
      CREATE TYPE "log_level_enum" AS ENUM ('info', 'warn', 'error', 'debug')
    `);
    await queryRunner.query(`
      CREATE TYPE "execution_status_enum" AS ENUM ('running', 'completed', 'failed')
    `);

    // ─── Users ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "name" varchar(100) NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users" ("email")`);

    // ─── Organizations ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_organizations" PRIMARY KEY ("id"),
        CONSTRAINT "uq_organizations_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_organizations_slug" ON "organizations" ("slug")`);

    // ─── Org Memberships ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "org_memberships" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "org_id" uuid NOT NULL,
        "role" "org_role_enum" DEFAULT 'member' NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_org_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "uq_org_membership" UNIQUE ("user_id", "org_id"),
        CONSTRAINT "fk_org_memberships_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_org_memberships_org" FOREIGN KEY ("org_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_org_memberships_user" ON "org_memberships" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_org_memberships_org" ON "org_memberships" ("org_id")`);

    // ─── Projects ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "org_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_projects" PRIMARY KEY ("id"),
        CONSTRAINT "uq_project_org_slug" UNIQUE ("org_id", "slug"),
        CONSTRAINT "fk_projects_org" FOREIGN KEY ("org_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_projects_org" ON "projects" ("org_id")`);

    // ─── Retry Policies ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "retry_policies" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "project_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "strategy" "retry_strategy_enum" DEFAULT 'exponential' NOT NULL,
        "max_retries" int DEFAULT 3 NOT NULL,
        "base_delay_ms" int DEFAULT 1000 NOT NULL,
        "max_delay_ms" int DEFAULT 300000 NOT NULL,
        "jitter" boolean DEFAULT true NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_retry_policies" PRIMARY KEY ("id"),
        CONSTRAINT "fk_retry_policies_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_retry_policies_project" ON "retry_policies" ("project_id")`);

    // ─── Queues ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "queues" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "project_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "priority" int DEFAULT 0 NOT NULL,
        "concurrency_limit" int DEFAULT 5 NOT NULL,
        "is_paused" boolean DEFAULT false NOT NULL,
        "retry_policy_id" uuid,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_queues" PRIMARY KEY ("id"),
        CONSTRAINT "uq_queue_project_slug" UNIQUE ("project_id", "slug"),
        CONSTRAINT "fk_queues_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_queues_retry_policy" FOREIGN KEY ("retry_policy_id")
          REFERENCES "retry_policies"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_queues_project" ON "queues" ("project_id")`);

    // ─── Workers ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "workers" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "status" "worker_status_enum" DEFAULT 'online' NOT NULL,
        "queues" text,
        "max_concurrency" int DEFAULT 10 NOT NULL,
        "current_load" int DEFAULT 0 NOT NULL,
        "registered_at" timestamptz NOT NULL,
        "last_heartbeat_at" timestamptz NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_workers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_workers_status" ON "workers" ("status")`);

    // ─── Jobs ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "queue_id" uuid NOT NULL,
        "idempotency_key" varchar(255),
        "type" "job_type_enum" DEFAULT 'immediate' NOT NULL,
        "status" "job_status_enum" DEFAULT 'queued' NOT NULL,
        "priority" int DEFAULT 0 NOT NULL,
        "payload" jsonb DEFAULT '{}' NOT NULL,
        "result" jsonb,
        "error" text,
        "ai_error_summary" text,
        "attempt" int DEFAULT 0 NOT NULL,
        "max_retries" int DEFAULT 3 NOT NULL,
        "retry_strategy" "retry_strategy_enum" DEFAULT 'exponential' NOT NULL,
        "retry_delay_ms" int DEFAULT 1000 NOT NULL,
        "scheduled_at" timestamptz,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "claimed_by" uuid,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_jobs_queue" FOREIGN KEY ("queue_id")
          REFERENCES "queues"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_jobs_worker" FOREIGN KEY ("claimed_by")
          REFERENCES "workers"("id") ON DELETE SET NULL
      )
    `);

    // THE critical indexes for job claiming and dashboard queries
    await queryRunner.query(`
      CREATE INDEX "idx_jobs_claim"
      ON "jobs" ("queue_id", "status", "priority" DESC, "created_at" ASC)
      WHERE "status" IN ('queued', 'scheduled')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_jobs_idempotency"
      ON "jobs" ("queue_id", "idempotency_key")
      WHERE "idempotency_key" IS NOT NULL
    `);
    await queryRunner.query(`CREATE INDEX "idx_jobs_status" ON "jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_jobs_queue_status" ON "jobs" ("queue_id", "status")`);
    await queryRunner.query(`
      CREATE INDEX "idx_jobs_scheduled"
      ON "jobs" ("scheduled_at")
      WHERE "status" = 'scheduled'
    `);

    // ─── Job Executions ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "job_executions" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "job_id" uuid NOT NULL,
        "worker_id" uuid NOT NULL,
        "attempt" int NOT NULL,
        "status" "execution_status_enum" DEFAULT 'running' NOT NULL,
        "started_at" timestamptz NOT NULL,
        "completed_at" timestamptz,
        "duration_ms" int,
        "error" text,
        "metadata" jsonb,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_job_executions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_job_executions_job" FOREIGN KEY ("job_id")
          REFERENCES "jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_job_executions_worker" FOREIGN KEY ("worker_id")
          REFERENCES "workers"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_job_executions_job" ON "job_executions" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "idx_job_executions_worker" ON "job_executions" ("worker_id")`);

    // ─── Job Logs ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "job_logs" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "job_id" uuid NOT NULL,
        "level" "log_level_enum" DEFAULT 'info' NOT NULL,
        "message" text NOT NULL,
        "metadata" jsonb,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_job_logs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_job_logs_job" FOREIGN KEY ("job_id")
          REFERENCES "jobs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_job_logs_job" ON "job_logs" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "idx_job_logs_created" ON "job_logs" ("created_at")`);

    // ─── Scheduled Jobs ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "scheduled_jobs" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "queue_id" uuid NOT NULL,
        "cron_expression" varchar(100) NOT NULL,
        "name" varchar(100),
        "payload" jsonb DEFAULT '{}' NOT NULL,
        "timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "next_run_at" timestamptz,
        "last_run_at" timestamptz,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_scheduled_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_scheduled_jobs_queue" FOREIGN KEY ("queue_id")
          REFERENCES "queues"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_scheduled_jobs_next_run"
      ON "scheduled_jobs" ("next_run_at")
      WHERE "is_active" = true
    `);
    await queryRunner.query(`CREATE INDEX "idx_scheduled_jobs_queue" ON "scheduled_jobs" ("queue_id")`);

    // ─── Dead Letter Queue ────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "dead_letter_queue" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "original_job_id" uuid NOT NULL,
        "queue_id" uuid NOT NULL,
        "payload" jsonb NOT NULL,
        "error" text NOT NULL,
        "ai_error_summary" text,
        "attempts" int NOT NULL,
        "failed_at" timestamptz NOT NULL,
        "replayed_at" timestamptz,
        "replayed_job_id" uuid,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_dead_letter_queue" PRIMARY KEY ("id"),
        CONSTRAINT "fk_dlq_original_job" FOREIGN KEY ("original_job_id")
          REFERENCES "jobs"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_dlq_queue" FOREIGN KEY ("queue_id")
          REFERENCES "queues"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_dlq_replayed_job" FOREIGN KEY ("replayed_job_id")
          REFERENCES "jobs"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_dlq_queue" ON "dead_letter_queue" ("queue_id")`);
    await queryRunner.query(`CREATE INDEX "idx_dlq_original_job" ON "dead_letter_queue" ("original_job_id")`);
    await queryRunner.query(`CREATE INDEX "idx_dlq_failed_at" ON "dead_letter_queue" ("failed_at")`);

    // ─── Worker Heartbeats ────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "worker_heartbeats" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "worker_id" uuid NOT NULL,
        "load" int DEFAULT 0 NOT NULL,
        "memory_mb" int,
        "cpu_percent" float,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_worker_heartbeats" PRIMARY KEY ("id"),
        CONSTRAINT "fk_worker_heartbeats_worker" FOREIGN KEY ("worker_id")
          REFERENCES "workers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_worker_heartbeats_worker" ON "worker_heartbeats" ("worker_id")`);
    await queryRunner.query(`CREATE INDEX "idx_worker_heartbeats_created" ON "worker_heartbeats" ("created_at")`);

    // ─── Rate Limits ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "rate_limits" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "project_id" uuid,
        "queue_id" uuid,
        "max_per_second" int DEFAULT 100 NOT NULL,
        "max_per_minute" int DEFAULT 1000 NOT NULL,
        "window_size_ms" int DEFAULT 60000 NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL,
        CONSTRAINT "pk_rate_limits" PRIMARY KEY ("id"),
        CONSTRAINT "chk_rate_limits_scope" CHECK ("project_id" IS NOT NULL OR "queue_id" IS NOT NULL),
        CONSTRAINT "fk_rate_limits_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_rate_limits_queue" FOREIGN KEY ("queue_id")
          REFERENCES "queues"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_rate_limits_project" ON "rate_limits" ("project_id")`);
    await queryRunner.query(`CREATE INDEX "idx_rate_limits_queue" ON "rate_limits" ("queue_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "rate_limits" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "worker_heartbeats" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dead_letter_queue" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_executions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "queues" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "retry_policies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_memberships" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "execution_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "log_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "worker_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "retry_strategy_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "org_role_enum"`);
  }
}
