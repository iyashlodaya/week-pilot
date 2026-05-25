// ─────────────────────────────────────────────────────────────
// WeekPilot — Retry Utility
// ─────────────────────────────────────────────────────────────

import { logger } from './logger.js';

export interface RetryOptions {
  /** Maximum number of attempts (default: 3). */
  maxAttempts?: number;
  /** Base delay in milliseconds before first retry (default: 1000). */
  baseDelay?: number;
  /** Multiplier for exponential backoff (default: 2). */
  backoffMultiplier?: number;
  /** Optional label for log messages. */
  label?: string;
}

/**
 * Retry an async function with exponential backoff.
 *
 * @example
 * const result = await retry(() => callOpenAI(prompt), {
 *   maxAttempts: 3,
 *   label: 'OpenAI API call',
 * });
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    backoffMultiplier = 2,
    label = 'operation',
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) {
        logger.error(
          `${label} failed after ${maxAttempts} attempts: ${lastError.message}`
        );
        break;
      }

      const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
      logger.warn(
        `${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
