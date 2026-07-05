# Forgeline — Distributed Job Scheduling Platform

Forgeline is a production-grade distributed job scheduling platform built to demonstrate advanced concurrency control, resilience, and exactly-once execution guarantees.

It avoids high-level job abstraction libraries (like BullMQ or Celery) in favor of building the transactional state machine directly on top of PostgreSQL using `SELECT ... FOR UPDATE SKIP LOCKED`.

## Features

- **Exactly-Once Execution**: Atomic job claiming via CTEs and SKIP LOCKED ensuring zero duplicate executions across scaled-out worker fleets.
- **Resilient Worker Lifecycle**:
  - Adaptive polling
  - Heartbeats
  - Reaper service to recover stuck jobs from crashed workers
  - Graceful SIGTERM shutdowns (draining)
- **Advanced Job Management**:
  - Immediate, delayed, and cron/recurring jobs
  - Batch job creation
  - Priorities and per-queue concurrency limits
  - Configurable retry strategies (Fixed, Linear, Exponential with Jitter)
- **Dead Letter Queue (DLQ)**: Failed jobs that exceed max retries are safely parked for inspection, with AI-generated root cause summaries.
- **The Forge Floor (Dashboard)**: Real-time UI built with React and Socket.io to visualize the active job pipeline and worker cluster health.

## Tech Stack

- **Monorepo**: NestJS (API + Worker) + Vite/React (Frontend)
- **Database**: PostgreSQL 16 + TypeORM
- **Real-time**: Socket.io
- **Language**: TypeScript throughout

## Running the Project

Since Forgeline relies on advanced PostgreSQL features, you must have PostgreSQL running.

1. **Start PostgreSQL**:
   ```bash
   docker-compose up -d
   ```
   *(If you don't have Docker installed, ensure you have a local PostgreSQL instance running and update `.env` accordingly).*

2. **Install Dependencies**:
   ```bash
   npm install
   cd apps/web && npm install
   ```

3. **Run Migrations & Seed**:
   ```bash
   npm run build:common
   npm run typeorm migration:run
   npx ts-node libs/database/src/seeds/seed.ts
   ```

4. **Start the Platform (in separate terminals)**:
   ```bash
   npm run start:api      # Starts the REST API on port 3000
   npm run start:worker   # Starts a background worker process
   npm run start:web      # Starts the UI on port 5173
   ```

## Concurrency Testing

To prove the platform's concurrency guarantees, a high-stress integration test is included. It spins up 10 simulated workers that concurrently bombard the database trying to claim the same 100 jobs.

```bash
npm run test:concurrency
```
*Expected result: Exactly 100 jobs claimed, zero duplicates.*
