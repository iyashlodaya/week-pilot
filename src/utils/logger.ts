// ─────────────────────────────────────────────────────────────
// WeekPilot — Logger
// ─────────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',   // gray
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

let currentLevel: LogLevel = 'info';
let useColors = true;

/**
 * Set the minimum log level. Messages below this level are suppressed.
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Enable or disable colored output.
 */
export function setColored(colored: boolean): void {
  useColors = colored;
}

function formatTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;

  const timestamp = formatTimestamp();
  const label = LEVEL_LABELS[level];

  if (useColors) {
    const color = LEVEL_COLORS[level];
    const prefix = `${DIM}${timestamp}${RESET} ${color}${label}${RESET}`;
    console.error(prefix, message, ...args);
  } else {
    console.error(`${timestamp} ${label}`, message, ...args);
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', message, ...args),

  /** Log a success message (uses info level with a ✓ prefix). */
  success: (message: string, ...args: unknown[]) => {
    if (LEVEL_PRIORITY['info'] < LEVEL_PRIORITY[currentLevel]) return;
    const timestamp = formatTimestamp();
    if (useColors) {
      console.error(`${DIM}${timestamp}${RESET} \x1b[32m✓${RESET}`, message, ...args);
    } else {
      console.error(`${timestamp} ✓`, message, ...args);
    }
  },
};
