// ─────────────────────────────────────────────────────────────
// WeekPilot — Markdown Notes Collector
// ─────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { globSync } from 'glob';
import matter from 'gray-matter';
import type { Note, DateRange } from '../types.js';
import { logger } from '../utils/logger.js';
import { isInRange, formatDate } from '../utils/dates.js';

/**
 * Collect notes from markdown and text files in the configured notes directory.
 *
 * Supports two patterns:
 * 1. Date-based filenames: `2026-05-25.md`, `2026-05-25-standup.md`
 * 2. Frontmatter date: files with `date: 2026-05-25` in YAML frontmatter
 *
 * @param notesDir - Absolute path to the notes directory
 * @param dateRange - Date range to filter notes
 * @returns Array of collected notes
 */
export function collectNotes(
  notesDir: string,
  dateRange: DateRange
): Note[] {
  const resolvedDir = path.resolve(notesDir);

  if (!fs.existsSync(resolvedDir)) {
    logger.debug(`Notes directory does not exist: ${resolvedDir}`);
    return [];
  }

  // Find all markdown and text files
  const files = globSync('**/*.{md,txt,markdown}', {
    cwd: resolvedDir,
    absolute: true,
    nodir: true,
  });

  const notes: Note[] = [];

  for (const filePath of files) {
    try {
      const note = parseNoteFile(filePath, dateRange);
      if (note) {
        notes.push(note);
      }
    } catch (err) {
      logger.warn(
        `Failed to parse note ${filePath}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Sort by date descending
  notes.sort((a, b) => b.date.localeCompare(a.date));

  logger.debug(`Collected ${notes.length} notes from ${resolvedDir}`);
  return notes;
}

/**
 * Parse a single note file and return a Note if it falls within the date range.
 */
function parseNoteFile(filePath: string, dateRange: DateRange): Note | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const basename = path.basename(filePath);

  // Try to extract date from frontmatter first, then filename
  const { data: frontmatter, content } = matter(raw);
  const date = extractDate(frontmatter, basename);

  if (!date) {
    logger.debug(`Skipping note without date: ${basename}`);
    return null;
  }

  // Check if note falls within our date range
  if (!isInRange(date, dateRange.from, dateRange.to)) {
    return null;
  }

  // Extract tags from frontmatter
  const tags = extractTags(frontmatter);

  // Clean up the content (remove frontmatter, trim)
  const cleanContent = content.trim();
  if (!cleanContent) {
    return null;
  }

  // Generate a stable ID from file path + content
  const id = crypto
    .createHash('sha256')
    .update(filePath + cleanContent)
    .digest('hex')
    .slice(0, 12);

  return {
    id,
    content: cleanContent,
    source: filePath,
    date,
    tags,
  };
}

/**
 * Try to extract a date from frontmatter data or filename.
 *
 * Supports:
 * - Frontmatter: `date: 2026-05-25` or `date: 2026-05-25T10:30:00`
 * - Filename: `2026-05-25.md`, `2026-05-25-standup.md`, `2026-05-25_notes.txt`
 */
function extractDate(
  frontmatter: Record<string, unknown>,
  filename: string
): string | null {
  // Try frontmatter date field
  if (frontmatter['date']) {
    const fmDate = frontmatter['date'];
    if (fmDate instanceof Date) {
      return formatDate(fmDate);
    }
    if (typeof fmDate === 'string') {
      const match = fmDate.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1]!;
    }
  }

  // Try filename pattern
  const filenameMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (filenameMatch) {
    return filenameMatch[1]!;
  }

  return null;
}

/**
 * Extract tags from frontmatter data.
 * Supports: `tags: [foo, bar]` or `tags: foo, bar`
 */
function extractTags(frontmatter: Record<string, unknown>): string[] {
  const raw = frontmatter['tags'];
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((t) => t.trim()).filter(Boolean);
  }

  return [];
}

// TODO(phase-2): Support inline tags like #tag in note content
// TODO(phase-2): Support nested directory structures (project/date.md)
// TODO(phase-2): Watch notes directory for changes (file watcher)
