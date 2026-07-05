import { RetryStrategy } from '../enums';
import { RetryDelayResult } from '../interfaces';

/**
 * Calculates retry delay based on strategy, attempt number, and configuration.
 * Includes optional jitter to prevent retry storms (thundering herd).
 *
 * @param strategy - The backoff strategy to use
 * @param attempt - Current attempt number (1-based)
 * @param maxRetries - Maximum allowed retry attempts
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap in milliseconds
 * @param useJitter - Whether to add random jitter (0-30%)
 */
export function calculateRetryDelay(
  strategy: RetryStrategy,
  attempt: number,
  maxRetries: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 300000,
  useJitter: boolean = true,
): RetryDelayResult {
  if (attempt >= maxRetries) {
    return {
      delayMs: 0,
      nextAttempt: attempt + 1,
      shouldRetry: false,
      moveToDlq: true,
    };
  }

  let delayMs: number;

  switch (strategy) {
    case RetryStrategy.FIXED:
      delayMs = baseDelayMs;
      break;

    case RetryStrategy.LINEAR:
      delayMs = baseDelayMs * (attempt + 1);
      break;

    case RetryStrategy.EXPONENTIAL:
      delayMs = baseDelayMs * Math.pow(2, attempt);
      break;

    default:
      delayMs = baseDelayMs;
  }

  // Cap at maximum delay
  delayMs = Math.min(delayMs, maxDelayMs);

  // Apply jitter: random value between 0% and 30% of the delay
  if (useJitter) {
    const jitterFactor = 1 + Math.random() * 0.3;
    delayMs = Math.floor(delayMs * jitterFactor);
  }

  return {
    delayMs,
    nextAttempt: attempt + 1,
    shouldRetry: true,
    moveToDlq: false,
  };
}

/**
 * Generates a unique worker name from hostname and process ID.
 */
export function generateWorkerName(prefix?: string): string {
  const hostname = require('os').hostname();
  const pid = process.pid;
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${prefix || 'worker'}-${hostname}-${pid}-${suffix}`;
}

/**
 * Creates a slug from a name string.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a request ID for structured logging.
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Validates a cron expression (basic validation).
 */
export function isValidCronExpression(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const ranges = [
    { min: 0, max: 59 }, // minute
    { min: 0, max: 23 }, // hour
    { min: 1, max: 31 }, // day of month
    { min: 1, max: 12 }, // month
    { min: 0, max: 7 },  // day of week (0 and 7 = Sunday)
  ];

  for (let i = 0; i < 5; i++) {
    const part = parts[i];
    if (part === '*') continue;
    if (/^\*\/\d+$/.test(part)) continue;
    if (/^\d+(,\d+)*$/.test(part)) continue;
    if (/^\d+-\d+$/.test(part)) continue;
    if (/^\d+-\d+\/\d+$/.test(part)) continue;
    return false;
  }

  return true;
}
