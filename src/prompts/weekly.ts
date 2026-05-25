// ─────────────────────────────────────────────────────────────
// WeekPilot — Weekly Summary Prompt
// ─────────────────────────────────────────────────────────────

import type { CollectedData } from '../types.js';
import { describeRange } from '../utils/dates.js';

/**
 * Build the system prompt for weekly summary generation.
 */
export function weeklySystemPrompt(): string {
  return `You are an engineering weekly report assistant. Your job is to transform a week's worth of git commits and notes into a clear, structured weekly summary suitable for filling into a status report or sharing with a manager.

Rules:
- Group work by project/theme, NOT by day
- Write in first person, past tense
- Highlight the most impactful work — not every tiny commit
- Summarize patterns (e.g., "Worked extensively on API integration" rather than listing 15 related commits)
- Be specific about what was accomplished, not vague
- Include quantitative details when apparent (e.g., "Fixed 3 critical bugs in dashboard")
- Keep the tone professional but natural — like writing a quick email to your manager
- Extract blockers and challenges from notes and commit context
- Suggest focus areas for next week based on the trajectory of work
- Do NOT invent work or accomplishments not supported by the data

Output format (use exactly these headers):

## Weekly Summary
A 2-3 sentence high-level overview of the week.

## Key Accomplishments
- Grouped by project/theme, bullet points

## Challenges & Blockers
- bullet points (or "None encountered this week")

## Next Week's Focus
- bullet points — what's likely coming up based on current trajectory`;
}

/**
 * Build the user prompt with the week's collected data.
 */
export function weeklyUserPrompt(data: CollectedData): string {
  const dateLabel = describeRange(data.dateRange.from, data.dateRange.to);
  const parts: string[] = [
    `Generate my weekly summary for the week of ${dateLabel}.`,
  ];

  // Git commits grouped by repo
  if (data.commits.length > 0) {
    const byRepo = new Map<string, typeof data.commits>();
    for (const commit of data.commits) {
      const list = byRepo.get(commit.repo) || [];
      list.push(commit);
      byRepo.set(commit.repo, list);
    }

    parts.push(`\n### Git Commits (${data.commits.length} total):`);
    for (const [repo, commits] of byRepo) {
      parts.push(`\n**${repo}** (${commits.length} commits):`);
      for (const commit of commits) {
        const dateShort = commit.date.slice(0, 10);
        parts.push(`- ${commit.message} (${dateShort}, ${commit.hash})`);
      }
    }
  } else {
    parts.push('\n### Git Commits:\nNo commits found for this week.');
  }

  // Notes
  if (data.notes.length > 0) {
    parts.push(`\n### Notes & Context (${data.notes.length} entries):`);
    for (const note of data.notes) {
      const dateShort = note.date.slice(0, 10);
      const tagStr = note.tags.length > 0 ? ` [${note.tags.join(', ')}]` : '';
      parts.push(`\n[${dateShort}]${tagStr}\n${note.content}`);
    }
  }

  return parts.join('\n');
}

// TODO(phase-2): Add manager-friendly summary mode (different tone, more polished)
// TODO(phase-2): Add Excel-compatible output format
// TODO(phase-2): Include calendar events in weekly context
