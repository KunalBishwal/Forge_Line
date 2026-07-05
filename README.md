# Forgeline — Distributed Job Scheduling Platform

Forgeline is a production-grade distributed job scheduling platform built to demonstrate advanced concurrency control, resilience, and exactly-once execution guarantees.

It avoids high-level job abstraction libraries (like BullMQ or Celery) in favor of building the transactional state machine directly on top of PostgreSQL using `SELECT ... FOR UPDATE SKIP LOCKED`.

## Features

- **Exactly-Once Execution**: Atomic job claiming via `SKIP LOCKED` ensuring zero duplicate executions across scaled-out worker fleets.
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

- **Backend**: NestJS (API + Worker apps), PostgreSQL 16, TypeORM
- **Frontend**: React + Vite + TypeScript, Tailwind, Socket.io-client
- **Real-time**: Socket.io
- **Language**: TypeScript throughout

## Project Structure
Forgeline/
├── backend/          # NestJS monorepo (API + Worker apps, shared libs)
├── frontend/         # React + Vite dashboard
├── docker-compose.yml
└── README.md

## Running the Project

Since Forgeline relies on advanced PostgreSQL features, you must have PostgreSQL running.

### 1. Start PostgreSQL

```bash
docker-compose up -d
```
*(If you don't have Docker installed, run a local PostgreSQL 16 instance and update `backend/.env` accordingly.)*

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
npm run migration:run
npm run seed
```

### 3. Start the backend (in two separate terminals, from `backend/`)

```bash
npm run start:api      # REST API on port 3000
npm run start:worker   # Background worker process
```

### 4. Frontend setup and start (in a third terminal)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev             # UI on http://localhost:5173
```

> Note: `frontend/.env` must set `VITE_API_URL=http://localhost:3000/api/v1` (the backend's global route prefix is `api/v1`) and `VITE_USE_MOCKS=false` to talk to the real backend instead of demo mock data.

### 5. Log in

Open `http://localhost:5173` and sign in with:
demo@forgeline.dev / forgeline123

## Testing

```bash
cd backend
npm test               # Unit tests (retry/backoff logic, etc.)
npm run test:e2e       # End-to-end tests
npm run test:concurrency
```

The concurrency test is the platform's core correctness proof: it spins up 10 simulated workers that concurrently attempt to claim the same 100 jobs against a real Postgres instance.

**Expected result: exactly 100 jobs claimed, zero duplicates.**

## API Documentation

Interactive Swagger docs are served at `http://localhost:3000/api/docs` once the API is running.

## License

Submitted as part of the Codity.AI Tech Assignment.
