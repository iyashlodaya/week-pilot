# 🧑‍✈️ WeekPilot

A lightweight AI agent that tracks your engineering work and generates clean standup updates and weekly summaries — so you never forget what you did by Monday.

## The Problem

You attend daily standups and fill out a weekly report every Monday. But by the time Monday arrives, you've forgotten half of what you worked on — the bug fixes, the debugging sessions, the cross-team discussions, and the small wins that add up.

**WeekPilot** collects signals from your daily engineering work (git commits + manual notes) and uses AI to generate natural, standup-ready summaries automatically.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set your API key

Depending on which provider you want to use, set the corresponding environment variables:

**OpenAI (Default)**
```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-your-key-here
```

**Gemini**
```bash
export LLM_PROVIDER=gemini
export GEMINI_API_KEY=your-gemini-key-here
```

### 3. Configure your repos

```bash
# Interactive setup
npx tsx src/cli.ts init

# Or add repos directly
npx tsx src/cli.ts config --repos-add /path/to/your/project
```

### 4. Generate your first standup

```bash
# Collect today's data and generate a daily standup
npx tsx src/cli.ts daily

# Or generate a weekly summary
npx tsx src/cli.ts weekly
```

## Commands

| Command | Description |
|---------|-------------|
| `weekpilot init` | Interactive setup wizard |
| `weekpilot collect` | Collect git commits and notes for a date/range |
| `weekpilot daily` | Generate a daily standup update |
| `weekpilot weekly` | Generate a weekly summary |
| `weekpilot note "text"` | Add a quick note for today |
| `weekpilot log` | Show collected raw data |
| `weekpilot config` | View or update configuration |

### Examples

```bash
# Daily standup for today (auto-collects)
weekpilot daily

# Daily standup for a specific date
weekpilot daily --date 2026-05-23

# Weekly summary for last week, saved to file
weekpilot weekly --week last --save

# Collect data from a date range
weekpilot collect --from 2026-05-19 --to 2026-05-23

# Add a quick note
weekpilot note "Investigated production timeout issue with DB team"

# Add a tagged note
weekpilot note "Release v2.1 deployed to staging" --tag release,deploy

# View collected data from the last 7 days
weekpilot log --days 7

# View only commits
weekpilot log --type commits
```

### Global Options

| Flag | Description |
|------|-------------|
| `--verbose` | Show debug logs |
| `--no-color` | Disable colored output |
| `-V, --version` | Show version number |

## Example Output

### Daily Standup
```
## Accomplishments
- Worked on API integration for claims service, added pagination support
- Fixed dashboard rendering bug causing stale data on tab switch
- Investigated production timeout issue — root cause traced to N+1 query

## Blockers
- Waiting on backend team to deploy updated auth middleware

## Next Steps
- Finish claims API error handling
- Write integration tests for pagination
```

### Weekly Summary
```
## Weekly Summary
Focused primarily on the claims service API integration and dashboard
stability fixes. Made significant progress on the migration path and
resolved a critical production issue.

## Key Accomplishments
- Claims Service: Completed API integration with pagination, error handling,
  and retry logic
- Dashboard: Fixed 3 rendering bugs including stale data and layout shift
- Production: Diagnosed and resolved timeout issue (N+1 query in reports endpoint)

## Challenges & Blockers
- Auth middleware deployment delayed by backend team (resolved Thursday)

## Next Week's Focus
- Complete claims service integration tests
- Begin frontend migration to new design system
- Production monitoring for the N+1 fix
```

## Architecture

```
src/
├── cli.ts                  # CLI entry point (Commander)
├── types.ts                # Shared TypeScript types
├── config.ts               # Config loader (~/.weekpilot/config.json + env vars)
├── collectors/             # Data collection modules
│   ├── git.ts              # Git commit collector (simple-git)
│   ├── notes.ts            # Markdown/text notes collector
│   └── index.ts            # Collector orchestrator
├── prompts/                # LLM prompt templates
│   ├── daily.ts            # Daily standup prompt
│   ├── weekly.ts           # Weekly summary prompt
│   └── index.ts
├── agents/                 # AI processing
│   └── summarizer.ts       # OpenAI summarization agent
├── memory/                 # Persistence layer
│   ├── db.ts               # SQLite operations (better-sqlite3)
│   └── index.ts            # High-level Memory API
├── outputs/                # Output formatting
│   ├── console.ts          # Terminal output with colors
│   ├── markdown.ts         # Markdown file output
│   └── index.ts
└── utils/
    ├── dates.ts            # Date utilities
    ├── logger.ts           # Structured logger
    └── retry.ts            # Async retry with backoff
```

### Key Design Decisions

- **Collectors are independent** — if one fails (e.g., a repo path is wrong), the others still run
- **Memory is persistent** — collected data is stored in SQLite, so you can regenerate summaries without re-collecting
- **Prompts are separated** — easy to tweak the AI's tone and format without touching logic
- **API key stays in env** — never persisted to config file for security

## Configuration

WeekPilot stores its data at `~/.weekpilot/` by default:

```
~/.weekpilot/
├── config.json             # Your configuration
├── weekpilot.db            # SQLite database
├── notes/                  # Manual notes directory
└── outputs/
    ├── daily/              # Saved daily summaries
    └── weekly/             # Saved weekly summaries
```

Configuration is loaded from `~/.weekpilot/config.json` with environment variable overrides:

| Env Variable | Description | Default |
|-------------|-------------|---------|
| `LLM_PROVIDER` | LLM provider to use (`openai` or `gemini`) | `openai` |
| `OPENAI_API_KEY` | OpenAI API key (required if `LLM_PROVIDER=openai`) | — |
| `WEEKPILOT_MODEL` | OpenAI model | `gpt-4o-mini` |
| `GEMINI_API_KEY` | Gemini API key (required if `LLM_PROVIDER=gemini`) | — |
| `WEEKPILOT_GEMINI_MODEL` | Gemini model | `gemini-flash-latest` |
| `WEEKPILOT_REPOS` | Comma-separated repo paths | — |
| `WEEKPILOT_NOTES_DIR` | Notes directory | `~/.weekpilot/notes` |
| `WEEKPILOT_DATA_DIR` | Data directory | `~/.weekpilot` |

## Development

```bash
# Run in development mode
npx tsx src/cli.ts <command>

# Type-check
npm run typecheck

# Build for production
npm run build

# Run production build
npm start -- <command>
```

## Roadmap

- [ ] Google Calendar integration
- [ ] Slack message collector
- [ ] Jira/Linear ticket collector
- [ ] Automatic daily cron collection
- [ ] Reminder notifications
- [ ] Voice-note input (Whisper API)
- [ ] Agent self-reflection step
- [ ] Long-term project memory
- [ ] Weekly Excel export
- [ ] Manager-friendly summary mode
- [ ] Local web UI for browsing history

## License

MIT
