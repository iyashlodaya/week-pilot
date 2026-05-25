// ─────────────────────────────────────────────────────────────
// WeekPilot — Core Type Definitions
// ─────────────────────────────────────────────────────────────

/**
 * A single git commit collected from a local repository.
 */
export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string; // ISO 8601
  repo: string; // repository name (basename of path)
  branch: string;
  filesChanged: number;
}

/**
 * A manual note parsed from a markdown/text file.
 */
export interface Note {
  id: string; // generated from filepath + content hash
  content: string;
  source: string; // original file path
  date: string; // ISO 8601
  tags: string[]; // extracted from frontmatter or inline tags
}

/**
 * Combined output from all collectors for a given date range.
 */
export interface CollectedData {
  commits: GitCommit[];
  notes: Note[];
  dateRange: DateRange;
}

/**
 * A date range with ISO 8601 date strings (YYYY-MM-DD).
 */
export interface DateRange {
  from: string;
  to: string;
}

/**
 * Structured sections extracted from a generated summary.
 */
export interface SummarySections {
  accomplishments: string[];
  blockers: string[];
  nextSteps: string[];
}

/**
 * A generated standup or weekly summary produced by the AI agent.
 */
export interface GeneratedSummary {
  id: string;
  type: 'daily' | 'weekly';
  date: string; // the date or week identifier this summary covers
  content: string; // clean formatted output
  sections: SummarySections;
  raw: string; // full LLM response text
  createdAt: string; // ISO 8601 timestamp
}

/**
 * Application configuration loaded from config file + env vars.
 */
export interface WeekPilotConfig {
  repos: string[];
  notesDir: string;
  dataDir: string;
  outputsDir: string;
  openaiApiKey: string;
  openaiModel: string;
  authorFilter?: string; // git author email/name to filter commits
}

/**
 * Options for the collect command.
 */
export interface CollectOptions {
  date?: string; // specific date (YYYY-MM-DD), defaults to today
  from?: string; // start of range
  to?: string; // end of range
  repos?: string[]; // override configured repos
}

/**
 * Options for generating summaries.
 */
export interface GenerateOptions {
  date?: string; // for daily: specific date; for weekly: any date in the target week
  save?: boolean; // persist output to file
  json?: boolean; // output as JSON
}

// TODO(phase-2): Add types for calendar events (Google Calendar integration)
// TODO(phase-2): Add types for Slack messages
// TODO(phase-2): Add types for Jira/Linear tickets
// TODO(phase-2): Add types for voice-note transcriptions
