import { calculateRetryDelay, RetryStrategy } from '@forgeline/common';

describe('Retry Delay Calculation', () => {
  describe('Fixed strategy', () => {
    it('should return constant delay regardless of attempt', () => {
      const r1 = calculateRetryDelay(RetryStrategy.FIXED, 0, 3, 5000, 300000, false);
      const r2 = calculateRetryDelay(RetryStrategy.FIXED, 1, 3, 5000, 300000, false);
      const r3 = calculateRetryDelay(RetryStrategy.FIXED, 2, 3, 5000, 300000, false);

      expect(r1.delayMs).toBe(5000);
      expect(r2.delayMs).toBe(5000);
      expect(r3.delayMs).toBe(5000);
      expect(r1.shouldRetry).toBe(true);
      expect(r2.shouldRetry).toBe(true);
      expect(r3.shouldRetry).toBe(true);
    });
  });

  describe('Linear strategy', () => {
    it('should increase delay linearly with attempt', () => {
      const r1 = calculateRetryDelay(RetryStrategy.LINEAR, 0, 5, 1000, 300000, false);
      const r2 = calculateRetryDelay(RetryStrategy.LINEAR, 1, 5, 1000, 300000, false);
      const r3 = calculateRetryDelay(RetryStrategy.LINEAR, 2, 5, 1000, 300000, false);

      expect(r1.delayMs).toBe(1000); // 1000 * (0+1)
      expect(r2.delayMs).toBe(2000); // 1000 * (1+1)
      expect(r3.delayMs).toBe(3000); // 1000 * (2+1)
    });
  });

  describe('Exponential strategy', () => {
    it('should increase delay exponentially', () => {
      const r1 = calculateRetryDelay(RetryStrategy.EXPONENTIAL, 0, 5, 1000, 300000, false);
      const r2 = calculateRetryDelay(RetryStrategy.EXPONENTIAL, 1, 5, 1000, 300000, false);
      const r3 = calculateRetryDelay(RetryStrategy.EXPONENTIAL, 2, 5, 1000, 300000, false);
      const r4 = calculateRetryDelay(RetryStrategy.EXPONENTIAL, 3, 5, 1000, 300000, false);

      expect(r1.delayMs).toBe(1000);  // 1000 * 2^0
      expect(r2.delayMs).toBe(2000);  // 1000 * 2^1
      expect(r3.delayMs).toBe(4000);  // 1000 * 2^2
      expect(r4.delayMs).toBe(8000);  // 1000 * 2^3
    });

    it('should cap delay at maxDelayMs', () => {
      const result = calculateRetryDelay(RetryStrategy.EXPONENTIAL, 20, 25, 1000, 60000, false);
      expect(result.delayMs).toBe(60000);
    });
  });

  describe('Max retries', () => {
    it('should return moveToDlq=true when attempt >= maxRetries', () => {
      const result = calculateRetryDelay(RetryStrategy.FIXED, 3, 3, 1000, 300000, false);

      expect(result.shouldRetry).toBe(false);
      expect(result.moveToDlq).toBe(true);
      expect(result.delayMs).toBe(0);
    });

    it('should return shouldRetry=true when under max retries', () => {
      const result = calculateRetryDelay(RetryStrategy.FIXED, 2, 3, 1000, 300000, false);
      expect(result.shouldRetry).toBe(true);
      expect(result.moveToDlq).toBe(false);
    });
  });

  describe('Jitter', () => {
    it('should add 0-30% jitter when enabled', () => {
      const results = new Set<number>();

      // Run 20 times and check that jitter produces varying delays
      for (let i = 0; i < 20; i++) {
        const r = calculateRetryDelay(RetryStrategy.FIXED, 0, 3, 10000, 300000, true);
        results.add(r.delayMs);
        // With jitter, delay should be between 10000 and 13000 (10000 + 30%)
        expect(r.delayMs).toBeGreaterThanOrEqual(10000);
        expect(r.delayMs).toBeLessThanOrEqual(13000);
      }

      // With jitter, we should see multiple different values
      expect(results.size).toBeGreaterThan(1);
    });
  });
});
