// ─────────────────────────────────────────────────────────────
// WeekPilot — Configuration Loader
// ─────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { WeekPilotConfig, LlmProvider } from './types.js';
import { logger } from './utils/logger.js';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.weekpilot');
const CONFIG_FILENAME = 'config.json';

/**
 * Resolve ~ to home directory in paths.
 */
function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Load configuration from ~/.weekpilot/config.json with env var overrides.
 * Creates default config file if it doesn't exist.
 */
export function loadConfig(): WeekPilotConfig {
  const dataDir = expandHome(process.env['WEEKPILOT_DATA_DIR'] || DEFAULT_DATA_DIR);
  const configPath = path.join(dataDir, CONFIG_FILENAME);

  // Ensure data directory exists
  ensureDir(dataDir);

  // Load file-based config if it exists
  let fileConfig: Partial<WeekPilotConfig> = {};
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw);
      logger.debug(`Loaded config from ${configPath}`);
    } catch (err) {
      logger.warn(`Failed to parse config file at ${configPath}: ${err}`);
    }
  }

  // Resolve LLM provider
  const rawProvider = (process.env['LLM_PROVIDER'] || fileConfig.llmProvider || 'openai').toLowerCase();
  const llmProvider: LlmProvider = rawProvider === 'gemini' ? 'gemini' : 'openai';

  // Build final config with env var overrides
  const config: WeekPilotConfig = {
    repos: parseRepos(process.env['WEEKPILOT_REPOS']) || fileConfig.repos || [],
    notesDir: expandHome(
      process.env['WEEKPILOT_NOTES_DIR'] || fileConfig.notesDir || path.join(dataDir, 'notes')
    ),
    dataDir,
    outputsDir: expandHome(fileConfig.outputsDir || path.join(dataDir, 'outputs')),
    llmProvider,
    openaiApiKey: process.env['OPENAI_API_KEY'] || fileConfig.openaiApiKey || '',
    openaiModel: process.env['WEEKPILOT_MODEL'] || fileConfig.openaiModel || 'gpt-4o-mini',
    geminiApiKey: process.env['GEMINI_API_KEY'] || fileConfig.geminiApiKey || '',
    geminiModel: process.env['WEEKPILOT_GEMINI_MODEL'] || fileConfig.geminiModel || 'gemini-flash-latest',
    authorFilter: process.env['WEEKPILOT_AUTHOR'] || fileConfig.authorFilter,
  };

  // Ensure output directories exist
  ensureDir(config.outputsDir);
  ensureDir(path.join(config.outputsDir, 'daily'));
  ensureDir(path.join(config.outputsDir, 'weekly'));
  ensureDir(config.notesDir);

  return config;
}

/**
 * Save configuration to disk.
 */
export function saveConfig(config: WeekPilotConfig): void {
  const configPath = path.join(config.dataDir, CONFIG_FILENAME);
  ensureDir(config.dataDir);

  // Don't persist API keys to file — keep them in env only
  const persistable = {
    repos: config.repos,
    notesDir: config.notesDir,
    outputsDir: config.outputsDir,
    llmProvider: config.llmProvider,
    openaiModel: config.openaiModel,
    geminiModel: config.geminiModel,
    authorFilter: config.authorFilter,
  };

  fs.writeFileSync(configPath, JSON.stringify(persistable, null, 2) + '\n', 'utf-8');
  logger.success(`Config saved to ${configPath}`);
}

/**
 * Validate that required config fields are present.
 * Returns a list of error messages (empty = valid).
 */
export function validateConfig(
  config: WeekPilotConfig,
  options: { requireApiKey?: boolean } = {}
): string[] {
  const errors: string[] = [];

  if (options.requireApiKey) {
    if (config.llmProvider === 'openai' && !config.openaiApiKey) {
      errors.push(
        'OPENAI_API_KEY is not set. Set it via environment variable or run `weekpilot init`.'
      );
    }
    if (config.llmProvider === 'gemini' && !config.geminiApiKey) {
      errors.push(
        'GEMINI_API_KEY is not set. Set it via environment variable or in your .env file.'
      );
    }
  }

  if (config.repos.length === 0) {
    errors.push(
      'No repos configured. Add repos via `weekpilot config --repos add /path/to/repo` or set WEEKPILOT_REPOS.'
    );
  }

  for (const repo of config.repos) {
    const expanded = expandHome(repo);
    if (!fs.existsSync(expanded)) {
      errors.push(`Repo path does not exist: ${expanded}`);
    }
  }

  return errors;
}

/**
 * Parse comma-separated repo paths from env var.
 */
function parseRepos(envValue: string | undefined): string[] | null {
  if (!envValue) return null;
  return envValue
    .split(',')
    .map((r) => expandHome(r.trim()))
    .filter(Boolean);
}

/**
 * Create a directory recursively if it doesn't exist.
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export { expandHome, ensureDir };
