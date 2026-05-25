// ─────────────────────────────────────────────────────────────
// WeekPilot — Memory API (high-level)
// ─────────────────────────────────────────────────────────────

import type {
  CollectedData,
  DateRange,
  GeneratedSummary,
} from '../types.js';
import {
  storeCommits,
  storeNotes,
  storeSummary,
  getCommitsByDateRange,
  getNotesByDateRange,
  getSummary,
  getRecentSummaries,
  closeDb,
} from './db.js';

/**
 * High-level memory interface for WeekPilot.
 * Wraps the raw database operations with cleaner semantics.
 */
export class Memory {
  constructor(private dataDir: string) {}

  /**
   * Persist collected data (commits + notes) to the database.
   */
  store(data: CollectedData): void {
    if (data.commits.length > 0) {
      storeCommits(this.dataDir, data.commits);
    }
    if (data.notes.length > 0) {
      storeNotes(this.dataDir, data.notes);
    }
  }

  /**
   * Retrieve all collected data for a date range from the database.
   * Useful for regenerating summaries without re-collecting.
   */
  recall(dateRange: DateRange): CollectedData {
    return {
      commits: getCommitsByDateRange(this.dataDir, dateRange),
      notes: getNotesByDateRange(this.dataDir, dateRange),
      dateRange,
    };
  }

  /**
   * Save a generated summary.
   */
  saveSummary(summary: GeneratedSummary): void {
    storeSummary(this.dataDir, summary);
  }

  /**
   * Get a specific summary by type and date.
   */
  getSummary(
    type: 'daily' | 'weekly',
    date: string
  ): GeneratedSummary | null {
    return getSummary(this.dataDir, type, date);
  }

  /**
   * Get the most recent summaries.
   */
  getRecent(
    type: 'daily' | 'weekly',
    limit: number = 5
  ): GeneratedSummary[] {
    return getRecentSummaries(this.dataDir, type, limit);
  }

  /**
   * Close the database connection.
   */
  close(): void {
    closeDb();
  }
}

// TODO(phase-2): Add long-term project memory (project names, team members, recurring topics)
// TODO(phase-2): Add semantic search over past summaries
// TODO(phase-2): Add memory compaction (summarize old entries)
