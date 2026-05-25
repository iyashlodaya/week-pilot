// ─────────────────────────────────────────────────────────────
// WeekPilot — SQLite Database Layer
// ─────────────────────────────────────────────────────────────

import * as path from 'node:path';
import Database from 'better-sqlite3';
import type { GitCommit, Note, GeneratedSummary, DateRange } from '../types.js';
import { logger } from '../utils/logger.js';
import { ensureDir } from '../config.js';

let db: Database.Database | null = null;

/**
 * Initialize (or get) the SQLite database connection.
 * Creates tables if they don't exist. Uses WAL mode for performance.
 */
export function getDb(dataDir: string): Database.Database {
  if (db) return db;

  const dbPath = path.join(dataDir, 'weekpilot.db');
  ensureDir(dataDir);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  logger.debug(`Database initialized at ${dbPath}`);

  return db;
}

/**
 * Close the database connection. Call on process exit.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ─── Schema ────────────────────────────────────────────────

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS commits (
      hash        TEXT PRIMARY KEY,
      message     TEXT NOT NULL,
      author      TEXT NOT NULL,
      date        TEXT NOT NULL,
      repo        TEXT NOT NULL,
      branch      TEXT DEFAULT 'unknown',
      files_changed INTEGER DEFAULT 0,
      collected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      source      TEXT NOT NULL,
      date        TEXT NOT NULL,
      tags        TEXT DEFAULT '[]',
      collected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL CHECK(type IN ('daily', 'weekly')),
      date        TEXT NOT NULL,
      content     TEXT NOT NULL,
      sections    TEXT NOT NULL DEFAULT '{}',
      raw         TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(date);
    CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo);
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
    CREATE INDEX IF NOT EXISTS idx_summaries_type_date ON summaries(type, date);
  `);
}

// ─── Commits ───────────────────────────────────────────────

const upsertCommitStmt = `
  INSERT INTO commits (hash, message, author, date, repo, branch, files_changed)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(hash) DO UPDATE SET
    message = excluded.message,
    author = excluded.author,
    date = excluded.date,
    repo = excluded.repo,
    branch = excluded.branch,
    files_changed = excluded.files_changed
`;

export function storeCommits(dataDir: string, commits: GitCommit[]): void {
  const database = getDb(dataDir);
  const stmt = database.prepare(upsertCommitStmt);

  const insertMany = database.transaction((items: GitCommit[]) => {
    for (const c of items) {
      stmt.run(c.hash, c.message, c.author, c.date, c.repo, c.branch, c.filesChanged);
    }
  });

  insertMany(commits);
  logger.debug(`Stored ${commits.length} commits`);
}

export function getCommitsByDateRange(
  dataDir: string,
  range: DateRange
): GitCommit[] {
  const database = getDb(dataDir);
  const rows = database
    .prepare(
      `SELECT hash, message, author, date, repo, branch, files_changed as filesChanged
       FROM commits
       WHERE date >= ? AND date <= ?
       ORDER BY date DESC`
    )
    .all(range.from, range.to + 'T23:59:59') as GitCommit[];

  return rows;
}

// ─── Notes ─────────────────────────────────────────────────

const upsertNoteStmt = `
  INSERT INTO notes (id, content, source, date, tags)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    content = excluded.content,
    source = excluded.source,
    date = excluded.date,
    tags = excluded.tags
`;

export function storeNotes(dataDir: string, notes: Note[]): void {
  const database = getDb(dataDir);
  const stmt = database.prepare(upsertNoteStmt);

  const insertMany = database.transaction((items: Note[]) => {
    for (const n of items) {
      stmt.run(n.id, n.content, n.source, n.date, JSON.stringify(n.tags));
    }
  });

  insertMany(notes);
  logger.debug(`Stored ${notes.length} notes`);
}

export function getNotesByDateRange(
  dataDir: string,
  range: DateRange
): Note[] {
  const database = getDb(dataDir);
  const rows = database
    .prepare(
      `SELECT id, content, source, date, tags
       FROM notes
       WHERE date >= ? AND date <= ?
       ORDER BY date DESC`
    )
    .all(range.from, range.to) as Array<{
    id: string;
    content: string;
    source: string;
    date: string;
    tags: string;
  }>;

  return rows.map((r) => ({
    ...r,
    tags: JSON.parse(r.tags) as string[],
  }));
}

// ─── Summaries ─────────────────────────────────────────────

export function storeSummary(dataDir: string, summary: GeneratedSummary): void {
  const database = getDb(dataDir);
  database
    .prepare(
      `INSERT INTO summaries (id, type, date, content, sections, raw, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content = excluded.content,
         sections = excluded.sections,
         raw = excluded.raw,
         created_at = excluded.created_at`
    )
    .run(
      summary.id,
      summary.type,
      summary.date,
      summary.content,
      JSON.stringify(summary.sections),
      summary.raw,
      summary.createdAt
    );

  logger.debug(`Stored ${summary.type} summary for ${summary.date}`);
}

export function getSummary(
  dataDir: string,
  type: 'daily' | 'weekly',
  date: string
): GeneratedSummary | null {
  const database = getDb(dataDir);
  const row = database
    .prepare(
      `SELECT id, type, date, content, sections, raw, created_at as createdAt
       FROM summaries
       WHERE type = ? AND date = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(type, date) as
    | {
        id: string;
        type: 'daily' | 'weekly';
        date: string;
        content: string;
        sections: string;
        raw: string;
        createdAt: string;
      }
    | undefined;

  if (!row) return null;

  return {
    ...row,
    sections: JSON.parse(row.sections),
  };
}

export function getRecentSummaries(
  dataDir: string,
  type: 'daily' | 'weekly',
  limit: number = 5
): GeneratedSummary[] {
  const database = getDb(dataDir);
  const rows = database
    .prepare(
      `SELECT id, type, date, content, sections, raw, created_at as createdAt
       FROM summaries
       WHERE type = ?
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(type, limit) as Array<{
    id: string;
    type: 'daily' | 'weekly';
    date: string;
    content: string;
    sections: string;
    raw: string;
    createdAt: string;
  }>;

  return rows.map((r) => ({
    ...r,
    sections: JSON.parse(r.sections),
  }));
}
