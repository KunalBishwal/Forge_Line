import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { WorkerOrchestratorService } from './orchestrator/orchestrator.service';
import { Logger } from '@nestjs/common';

/**
 * Worker Process Entry Point.
 *
 * This is a separate Node.js process — NOT an HTTP server.
 * It uses NestFactory.createApplicationContext() to get DI
 * without binding to an HTTP port.
 *
 * Responsibilities:
 * - Poll queues and atomically claim jobs (SKIP LOCKED)
 * - Execute jobs concurrently
 * - Send heartbeats
 * - Reap stuck/orphaned jobs
 * - Run cron scheduler
 * - Handle graceful shutdown (SIGTERM)
 */
async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const orchestrator = app.get(WorkerOrchestratorService);

  // ─── Graceful Shutdown ────────────────────────────
  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal} — initiating graceful shutdown...`);
    await orchestrator.shutdown();
    await app.close();
    logger.log('Worker shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ─── Start Worker ─────────────────────────────────
  await orchestrator.start();

  logger.log(`
  ╔══════════════════════════════════════════════╗
  ║          🔥 FORGELINE WORKER STARTED         ║
  ║──────────────────────────────────────────────║
  ║  Worker: ${orchestrator.getWorkerName().padEnd(35)}║
  ║  Concurrency: ${String(orchestrator.getMaxConcurrency()).padEnd(30)}║
  ║  Poll Interval: ${String(orchestrator.getPollInterval() + 'ms').padEnd(27)}║
  ╚══════════════════════════════════════════════╝
  `);
}

bootstrap();
