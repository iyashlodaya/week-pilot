// ─────────────────────────────────────────────────────────────
// WeekPilot — Daily Standup Prompt
// ─────────────────────────────────────────────────────────────

import type { CollectedData } from '../types.js';
import { describeRange } from '../utils/dates.js';

/**
 * Build the system prompt for daily standup generation.
 */
export function dailySystemPrompt(): string {
  return `You are a concise engineering standup assistant. Your job is to transform raw git commits and notes into a clean, natural-sounding daily standup update.

Rules:
- Write in first person, past tense for accomplishments ("Worked on...", "Fixed...", "Investigated...")
- Keep each bullet point to 1 line — no lengthy descriptions
- Group related commits into a single meaningful bullet point
- Ignore trivial commits (typos, formatting, merge commits, version bumps)
- Sound like a real engineer talking in a standup — casual but professional
- If there are blockers or challenges mentioned in notes, list them separately
- If you can infer next steps from the context, suggest them briefly
- Do NOT make up work that isn't evident from the data
- Do NOT add generic filler like "continued working on various tasks"

Output format (use exactly these headers):
## Accomplishments
- bullet points...

## Blockers
- bullet points... (or "None" if no blockers are apparent)

## Next Steps
- bullet points... (brief, based on context)`;
}

/**
 * Build the user prompt with the day's collected data.
 */
export function dailyUserPrompt(data: CollectedData): string {
  const dateLabel = describeRange(data.dateRange.from, data.dateRange.to);
  const parts: string[] = [`Generate my daily standup update for ${dateLabel}.`];

  // Git commits
  if (data.commits.length > 0) {
    parts.push('\n### Git Commits:');
    for (const commit of data.commits) {
      parts.push(`- [${commit.repo}] ${commit.message} (${commit.hash})`);
    }
  } else {
    parts.push('\n### Git Commits:\nNo commits found for this day.');
  }

  // Notes
  if (data.notes.length > 0) {
    parts.push('\n### Manual Notes:');
    for (const note of data.notes) {
      const tagStr = note.tags.length > 0 ? ` [${note.tags.join(', ')}]` : '';
      parts.push(`${note.content}${tagStr}`);
    }
  }

  return parts.join('\n');
}
