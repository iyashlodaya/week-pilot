// ─────────────────────────────────────────────────────────────
// WeekPilot — Git Commit Collector
// ─────────────────────────────────────────────────────────────

import * as path from 'node:path';
import * as fs from 'node:fs';
import { simpleGit, type SimpleGit, type LogResult } from 'simple-git';
import type { GitCommit, DateRange } from '../types.js';
import { logger } from '../utils/logger.js';

/**
 * Collect git commits from a list of local repositories within a date range.
 *
 * @param repoPaths - Absolute paths to git repositories
 * @param dateRange - Date range to filter commits (YYYY-MM-DD)
 * @param authorFilter - Optional author name/email to filter by
 * @returns Array of collected commits, deduplicated by hash
 */
export async function collectGitCommits(
  repoPaths: string[],
  dateRange: DateRange,
  authorFilter?: string
): Promise<GitCommit[]> {
  const allCommits: GitCommit[] = [];
  const seenHashes = new Set<string>();

  for (const repoPath of repoPaths) {
    try {
      const commits = await collectFromRepo(repoPath, dateRange, authorFilter);
      for (const commit of commits) {
        if (!seenHashes.has(commit.hash)) {
          seenHashes.add(commit.hash);
          allCommits.push(commit);
        }
      }
      logger.debug(
        `Collected ${commits.length} commits from ${path.basename(repoPath)}`
      );
    } catch (err) {
      logger.warn(
        `Skipping repo ${repoPath}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Sort by date descending (newest first)
  allCommits.sort((a, b) => b.date.localeCompare(a.date));

  return allCommits;
}

/**
 * Collect commits from a single repository.
 */
async function collectFromRepo(
  repoPath: string,
  dateRange: DateRange,
  authorFilter?: string
): Promise<GitCommit[]> {
  const resolvedPath = path.resolve(repoPath);

  // Validate the path is a git repo
  if (!fs.existsSync(path.join(resolvedPath, '.git'))) {
    throw new Error(`Not a git repository: ${resolvedPath}`);
  }

  const git: SimpleGit = simpleGit(resolvedPath);
  const repoName = path.basename(resolvedPath);

  // Get current branch
  let currentBranch = 'unknown';
  try {
    const branchResult = await git.branch();
    currentBranch = branchResult.current;
  } catch {
    // branch detection can fail in detached HEAD state
  }

  // Build log options
  const logOptions: Record<string, string | number | undefined> = {
    '--since': dateRange.from,
    '--until': addOneDay(dateRange.to), // --until is exclusive, so add a day
    '--no-merges': undefined, // skip merge commits — they add noise
  };

  if (authorFilter) {
    logOptions['--author'] = authorFilter;
  }

  const logResult: LogResult = await git.log(logOptions);

  return logResult.all.map((entry) => ({
    hash: entry.hash.slice(0, 8), // short hash
    message: cleanCommitMessage(entry.message),
    author: entry.author_name,
    date: entry.date,
    repo: repoName,
    branch: currentBranch,
    filesChanged: 0, // simple-git log doesn't include this by default
  }));
}

/**
 * Clean up a commit message for display.
 * Removes conventional commit prefixes noise, keeps it readable.
 */
function cleanCommitMessage(message: string): string {
  return message
    .split('\n')[0]! // first line only
    .trim();
}

/**
 * Add one day to a YYYY-MM-DD date string.
 * Used because git --until is exclusive.
 */
function addOneDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// TODO(phase-2): Add --stat parsing for filesChanged count
// TODO(phase-2): Support collecting from multiple branches
// TODO(phase-2): Add commit diff summary for richer context
