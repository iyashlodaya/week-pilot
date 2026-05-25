#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// WeekPilot — CLI Entry Point
// ─────────────────────────────────────────────────────────────

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as readline from 'node:readline';

import { loadConfig, saveConfig, validateConfig, expandHome } from './config.js';
import { collectAll } from './collectors/index.js';
import { Memory } from './memory/index.js';
import { Summarizer } from './agents/summarizer.js';
import {
  printSummary,
  printCollectedData,
  printNoteAdded,
  printConfig,
  setConsoleColored,
  saveSummaryToFile,
} from './outputs/index.js';
import {
  today,
  startOfWeek,
  endOfWeek,
  currentWorkingWeek,
  lastWorkingWeek,
  parseDate,
  formatDate,
} from './utils/dates.js';
import { logger, setLogLevel, setColored } from './utils/logger.js';
import { closeDb } from './memory/db.js';

import type { WeekPilotConfig, DateRange, Note } from './types.js';

// ─── Program ───────────────────────────────────────────────

const program = new Command();

program
  .name('weekpilot')
  .description(
    '🧑‍✈️ WeekPilot — AI-powered standup updates and weekly summaries from your git history & notes'
  )
  .version('0.1.0')
  .option('--verbose', 'Enable debug logging')
  .option('--no-color', 'Disable colored output')
  .hook('preAction', (_thisCommand, _actionCommand) => {
    const opts = program.opts();
    if (opts['verbose']) setLogLevel('debug');
    if (opts['color'] === false) {
      setColored(false);
      setConsoleColored(false);
    }
  });

// ─── init ──────────────────────────────────────────────────

program
  .command('init')
  .description('Interactive setup — configure repos, notes dir, and API key')
  .action(async () => {
    const config = loadConfig();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (question: string): Promise<string> =>
      new Promise((resolve) => rl.question(question, resolve));

    console.log('');
    console.log('🧑‍✈️ Welcome to WeekPilot setup!\n');

    // Repos
    const repoInput = await ask(
      `Git repos to track (comma-separated paths)\n  Current: ${config.repos.join(', ') || '(none)'}\n  > `
    );
    if (repoInput.trim()) {
      config.repos = repoInput
        .split(',')
        .map((r) => expandHome(r.trim()))
        .filter(Boolean);
    }

    // Notes directory
    const notesInput = await ask(
      `\nNotes directory\n  Current: ${config.notesDir}\n  > `
    );
    if (notesInput.trim()) {
      config.notesDir = expandHome(notesInput.trim());
    }

    // Author filter
    const authorInput = await ask(
      `\nGit author filter (name or email, leave blank for all)\n  Current: ${config.authorFilter || '(all)'}\n  > `
    );
    if (authorInput.trim()) {
      config.authorFilter = authorInput.trim();
    }

    // Model
    const modelInput = await ask(
      `\nOpenAI model\n  Current: ${config.openaiModel}\n  > `
    );
    if (modelInput.trim()) {
      config.openaiModel = modelInput.trim();
    }

    rl.close();

    saveConfig(config);
    console.log(
      '\n💡 Set your API key via: export OPENAI_API_KEY=sk-...\n'
    );
  });

// ─── collect ───────────────────────────────────────────────

program
  .command('collect')
  .description('Collect git commits and notes for a date or range')
  .option('-d, --date <date>', 'Specific date (YYYY-MM-DD)', today())
  .option('-f, --from <date>', 'Start of date range')
  .option('-t, --to <date>', 'End of date range')
  .option('-r, --repos <paths>', 'Override repos (comma-separated)')
  .action(async (opts) => {
    const config = loadConfig();
    applyRepoOverride(config, opts.repos);

    const errors = validateConfig(config);
    if (errors.length > 0) {
      for (const e of errors) logger.error(e);
      process.exit(1);
    }

    const dateRange = resolveDateRange(opts);
    const data = await collectAll(config, dateRange);

    // Persist to database
    const memory = new Memory(config.dataDir);
    memory.store(data);
    memory.close();

    printCollectedData(data);
  });

// ─── daily ─────────────────────────────────────────────────

program
  .command('daily')
  .description('Generate a daily standup update')
  .option('-d, --date <date>', 'Date to generate for (YYYY-MM-DD)', today())
  .option('-s, --save', 'Save output to a markdown file')
  .option('--collect', 'Collect fresh data before generating', true)
  .option('--no-collect', 'Use only previously collected data')
  .action(async (opts) => {
    const config = loadConfig();

    const errors = validateConfig(config, { requireApiKey: true });
    if (errors.length > 0) {
      for (const e of errors) logger.error(e);
      process.exit(1);
    }

    const dateRange: DateRange = { from: opts.date, to: opts.date };
    const memory = new Memory(config.dataDir);

    let data;
    if (opts.collect) {
      // Collect fresh data
      data = await collectAll(config, dateRange);
      memory.store(data);
    } else {
      // Use stored data
      data = memory.recall(dateRange);
    }

    if (data.commits.length === 0 && data.notes.length === 0) {
      logger.warn(
        'No data found for this date. Run `weekpilot collect` first or check your config.'
      );
      memory.close();
      return;
    }

    // Generate summary
    const summarizer = new Summarizer(config);
    const summary = await summarizer.generateDaily(data);

    // Store summary
    memory.saveSummary(summary);
    memory.close();

    // Output
    printSummary(summary);

    if (opts.save) {
      const filepath = saveSummaryToFile(config, summary);
      console.log(`  📄 Saved to ${filepath}\n`);
    }
  });

// ─── weekly ────────────────────────────────────────────────

program
  .command('weekly')
  .description('Generate a weekly summary')
  .option(
    '-w, --week <week>',
    'Week to summarize: "current", "last", or a date within the week',
    'current'
  )
  .option('-s, --save', 'Save output to a markdown file')
  .option('--collect', 'Collect fresh data before generating', true)
  .option('--no-collect', 'Use only previously collected data')
  .action(async (opts) => {
    const config = loadConfig();

    const errors = validateConfig(config, { requireApiKey: true });
    if (errors.length > 0) {
      for (const e of errors) logger.error(e);
      process.exit(1);
    }

    // Resolve week to date range
    let dateRange: DateRange;
    if (opts.week === 'last') {
      dateRange = lastWorkingWeek();
    } else if (opts.week === 'current') {
      dateRange = currentWorkingWeek();
    } else {
      // Treat as a date within the target week
      const d = parseDate(opts.week);
      dateRange = { from: startOfWeek(d), to: endOfWeek(d) };
    }

    const memory = new Memory(config.dataDir);

    let data;
    if (opts.collect) {
      data = await collectAll(config, dateRange);
      memory.store(data);
    } else {
      data = memory.recall(dateRange);
    }

    if (data.commits.length === 0 && data.notes.length === 0) {
      logger.warn(
        'No data found for this week. Run `weekpilot collect` first or check your config.'
      );
      memory.close();
      return;
    }

    const summarizer = new Summarizer(config);
    const summary = await summarizer.generateWeekly(data);

    memory.saveSummary(summary);
    memory.close();

    printSummary(summary);

    if (opts.save) {
      const filepath = saveSummaryToFile(config, summary);
      console.log(`  📄 Saved to ${filepath}\n`);
    }
  });

// ─── note ──────────────────────────────────────────────────

program
  .command('note <text...>')
  .description('Add a quick note for today (without opening a file)')
  .option('-d, --date <date>', 'Date for the note (YYYY-MM-DD)', today())
  .option('--tag <tags>', 'Comma-separated tags')
  .action((textParts: string[], opts) => {
    const config = loadConfig();
    const text = textParts.join(' ');
    const date = opts.date;

    // Save note to the notes directory as a file
    const notesDir = config.notesDir;
    const filename = `${date}.md`;
    const filepath = path.join(notesDir, filename);

    let existingContent = '';
    if (fs.existsSync(filepath)) {
      existingContent = fs.readFileSync(filepath, 'utf-8');
    } else {
      // Create new file with frontmatter
      existingContent = `---\ndate: ${date}\ntags: []\n---\n`;
    }

    // Append the note
    const noteEntry = `\n- ${text}`;
    fs.writeFileSync(filepath, existingContent + noteEntry + '\n', 'utf-8');

    // Also store in database
    const memory = new Memory(config.dataDir);
    const note: Note = {
      id: crypto
        .createHash('sha256')
        .update(filepath + text + date)
        .digest('hex')
        .slice(0, 12),
      content: text,
      source: filepath,
      date,
      tags: opts.tag ? opts.tag.split(',').map((t: string) => t.trim()) : [],
    };
    memory.store({ commits: [], notes: [note], dateRange: { from: date, to: date } });
    memory.close();

    printNoteAdded(text, date);
  });

// ─── log ───────────────────────────────────────────────────

program
  .command('log')
  .description('Show collected raw data')
  .option('-d, --days <n>', 'Number of days to look back', '7')
  .option('-t, --type <type>', 'Filter: commits, notes, or all', 'all')
  .action((opts) => {
    const config = loadConfig();
    const memory = new Memory(config.dataDir);

    const toDate = today();
    const fromDate = formatDate(
      new Date(Date.now() - parseInt(opts.days) * 86400000)
    );

    const data = memory.recall({ from: fromDate, to: toDate });
    memory.close();

    // Filter by type if specified
    if (opts.type === 'commits') {
      data.notes = [];
    } else if (opts.type === 'notes') {
      data.commits = [];
    }

    printCollectedData(data);
  });

// ─── config ────────────────────────────────────────────────

program
  .command('config')
  .description('View or update configuration')
  .option('--show', 'Show current configuration')
  .option('--repos-add <path>', 'Add a repo path')
  .option('--repos-remove <path>', 'Remove a repo path')
  .action((opts) => {
    const config = loadConfig();

    if (opts.reposAdd) {
      const newRepo = expandHome(opts.reposAdd);
      if (!config.repos.includes(newRepo)) {
        config.repos.push(newRepo);
        saveConfig(config);
        logger.success(`Added repo: ${newRepo}`);
      } else {
        logger.info(`Repo already configured: ${newRepo}`);
      }
    }

    if (opts.reposRemove) {
      const removeRepo = expandHome(opts.reposRemove);
      config.repos = config.repos.filter((r) => r !== removeRepo);
      saveConfig(config);
      logger.success(`Removed repo: ${removeRepo}`);
    }

    // Always show config after changes, or if --show flag
    if (opts.show || opts.reposAdd || opts.reposRemove) {
      printConfig({
        dataDir: config.dataDir,
        notesDir: config.notesDir,
        outputsDir: config.outputsDir,
        repos: config.repos,
        openaiModel: config.openaiModel,
        openaiApiKey: config.openaiApiKey,
        authorFilter: config.authorFilter || '(all)',
      });
    } else {
      // Default to showing config
      printConfig({
        dataDir: config.dataDir,
        notesDir: config.notesDir,
        outputsDir: config.outputsDir,
        repos: config.repos,
        openaiModel: config.openaiModel,
        openaiApiKey: config.openaiApiKey,
        authorFilter: config.authorFilter || '(all)',
      });
    }
  });

// ─── Helpers ───────────────────────────────────────────────

function resolveDateRange(opts: {
  date?: string;
  from?: string;
  to?: string;
}): DateRange {
  if (opts.from && opts.to) {
    return { from: opts.from, to: opts.to };
  }
  if (opts.from) {
    return { from: opts.from, to: today() };
  }
  const date = opts.date || today();
  return { from: date, to: date };
}

function applyRepoOverride(
  config: WeekPilotConfig,
  reposFlag?: string
): void {
  if (reposFlag) {
    config.repos = reposFlag
      .split(',')
      .map((r) => expandHome(r.trim()))
      .filter(Boolean);
  }
}

// ─── Cleanup ───────────────────────────────────────────────

process.on('exit', () => closeDb());
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

// ─── Parse & Run ───────────────────────────────────────────

program.parse();
