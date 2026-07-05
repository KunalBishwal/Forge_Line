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
