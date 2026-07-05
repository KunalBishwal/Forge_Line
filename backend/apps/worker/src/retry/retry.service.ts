import { Injectable } from '@nestjs/common';
import { calculateRetryDelay, RetryStrategy, RetryDelayResult } from '@forgeline/common';

/**
 * Retry Service — encapsulates retry delay calculation logic.
 * Used by the executor to determine whether to retry or move to DLQ.
 *
 * Strategies:
 * - Fixed:       delay = base_delay_ms (constant)
 * - Linear:      delay = base_delay_ms * attempt
 * - Exponential: delay = base_delay_ms * 2^attempt (capped at max_delay_ms)
 *
 * All strategies support jitter (random 0-30% extra) to prevent retry storms.
 */
@Injectable()
export class RetryService {
  /**
   * Calculates the retry decision for a failed job.
   */
  getRetryDecision(
    strategy: RetryStrategy,
    currentAttempt: number,
    maxRetries: number,
    baseDelayMs: number,
    maxDelayMs: number = 300000,
    useJitter: boolean = true,
  ): RetryDelayResult {
    return calculateRetryDelay(
      strategy,
      currentAttempt,
      maxRetries,
      baseDelayMs,
      maxDelayMs,
      useJitter,
    );
  }

  /**
   * Generates a descriptive string for the retry strategy.
   */
  describeStrategy(strategy: RetryStrategy): string {
    switch (strategy) {
      case RetryStrategy.FIXED:
        return 'Fixed delay between retries';
      case RetryStrategy.LINEAR:
        return 'Linearly increasing delay (delay × attempt)';
      case RetryStrategy.EXPONENTIAL:
        return 'Exponentially increasing delay with jitter (2^attempt × base)';
      default:
        return 'Unknown strategy';
    }
  }
}
