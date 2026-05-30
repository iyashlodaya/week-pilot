// ─────────────────────────────────────────────────────────────
// WeekPilot — Console Output
// ─────────────────────────────────────────────────────────────

import type { GeneratedSummary, CollectedData } from '../types.js';

// ANSI color codes
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

let colored = true;

export function setConsoleColored(value: boolean): void {
  colored = value;
}

function c(code: string, text: string): string {
  return colored ? `${code}${text}${C.reset}` : text;
}

/**
 * Print a generated summary to stdout with nice formatting.
 */
export function printSummary(summary: GeneratedSummary): void {
  const typeLabel =
    summary.type === 'daily' ? '📋 Daily Standup' : '📊 Weekly Summary';
  const header = `${typeLabel} — ${summary.date}`;

  console.log('');
  console.log(c(C.bold + C.cyan, '═'.repeat(56)));
  console.log(c(C.bold + C.cyan, `  ${header}`));
  console.log(c(C.bold + C.cyan, '═'.repeat(56)));
  console.log('');
  console.log(summary.content);
  console.log('');
  console.log(
    c(C.dim, `Generated at ${new Date(summary.createdAt).toLocaleString()}`)
  );
  console.log('');
}

/**
 * Print collected raw data for debugging / the `log` command.
 */
export function printCollectedData(data: CollectedData): void {
  const { commits, notes, dateRange } = data;

  console.log('');
  console.log(
    c(C.bold + C.magenta, `📦 Collected Data: ${dateRange.from} → ${dateRange.to}`)
  );
  console.log('');

  // Commits
  console.log(c(C.bold + C.blue, `  Git Commits (${commits.length}):`));
  if (commits.length === 0) {
    console.log(c(C.dim, '    No commits found'));
  } else {
    for (const commit of commits) {
      const hash = c(C.yellow, commit.hash);
      const repo = c(C.cyan, commit.repo);
      const date = c(C.dim, commit.date.slice(0, 10));
      console.log(`    ${hash} ${repo} ${commit.message} ${date}`);
    }
  }

  console.log('');

  // Notes
  console.log(c(C.bold + C.blue, `  Notes (${notes.length}):`));
  if (notes.length === 0) {
    console.log(c(C.dim, '    No notes found'));
  } else {
    for (const note of notes) {
      const date = c(C.dim, note.date);
      const tags =
        note.tags.length > 0 ? c(C.green, ` [${note.tags.join(', ')}]`) : '';
      // Show first line of content, truncated
      const preview =
        note.content.split('\n')[0]!.slice(0, 80) +
        (note.content.length > 80 ? '...' : '');
      console.log(`    ${date}${tags} ${preview}`);
    }
  }

  console.log('');
}

/**
 * Print a quick note confirmation.
 */
export function printNoteAdded(content: string, date: string): void {
  console.log('');
  console.log(c(C.green, '  ✓ Note added'));
  console.log(c(C.dim, `    Date: ${date}`));
  console.log(`    ${content}`);
  console.log('');
}

/**
 * Print configuration details.
 */
export function printConfig(config: Record<string, unknown>): void {
  console.log('');
  console.log(c(C.bold + C.cyan, '  ⚙ WeekPilot Configuration'));
  console.log('');
  for (const [key, value] of Object.entries(config)) {
    const displayValue =
      (key === 'openaiApiKey' || key === 'geminiApiKey') && typeof value === 'string' && value.length > 0
        ? value.slice(0, 7) + '...' + value.slice(-4)
        : Array.isArray(value)
          ? value.length > 0
            ? '\n' + value.map((v) => `      - ${v}`).join('\n')
            : '(none)'
          : String(value);
    console.log(`    ${c(C.dim, key + ':')} ${displayValue}`);
  }
  console.log('');
}
