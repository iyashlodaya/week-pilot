// ─────────────────────────────────────────────────────────────
// WeekPilot — Collector Orchestrator
// ─────────────────────────────────────────────────────────────

import type {
  CollectedData,
  DateRange,
  WeekPilotConfig,
} from '../types.js';
import { collectGitCommits } from './git.js';
import { collectNotes } from './notes.js';
import { logger } from '../utils/logger.js';

// TODO(phase-2): Import and run calendar collector
// TODO(phase-2): Import and run Slack collector
// TODO(phase-2): Import and run Jira/Linear collector

/**
 * Run all configured collectors and merge their results.
 *
 * Each collector runs independently — if one fails, the others
 * still produce results. This makes the system resilient to
 * partial failures (e.g., a missing repo or unreadable notes dir).
 */
export async function collectAll(
  config: WeekPilotConfig,
  dateRange: DateRange
): Promise<CollectedData> {
  logger.info(`Collecting data for ${dateRange.from} → ${dateRange.to}`);

  const data: CollectedData = {
    commits: [],
    notes: [],
    dateRange,
  };

  // ── Git commits ──────────────────────────────────────────
  if (config.repos.length > 0) {
    try {
      data.commits = await collectGitCommits(
        config.repos,
        dateRange,
        config.authorFilter
      );
      logger.success(
        `${data.commits.length} commits from ${config.repos.length} repo(s)`
      );
    } catch (err) {
      logger.error(
        `Git collection failed: ${err instanceof Error ? err.message : err}`
      );
    }
  } else {
    logger.warn('No repos configured — skipping git collection');
  }

  // ── Manual notes ─────────────────────────────────────────
  try {
    data.notes = collectNotes(config.notesDir, dateRange);
    logger.success(`${data.notes.length} notes found`);
  } catch (err) {
    logger.error(
      `Notes collection failed: ${err instanceof Error ? err.message : err}`
    );
  }

  // ── Summary ──────────────────────────────────────────────
  const total = data.commits.length + data.notes.length;
  if (total === 0) {
    logger.warn('No data collected. Check your repos and notes directory.');
  }

  return data;
}

export { collectGitCommits } from './git.js';
export { collectNotes } from './notes.js';
