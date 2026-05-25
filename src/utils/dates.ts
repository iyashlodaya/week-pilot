// ─────────────────────────────────────────────────────────────
// WeekPilot — Date Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Get today's date as YYYY-MM-DD in local timezone.
 */
export function today(): string {
  return formatDate(new Date());
}

/**
 * Format a Date object as YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string into a Date object (local timezone, start of day).
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}

/**
 * Get the Monday of the week containing the given date.
 * Week starts on Monday (ISO 8601).
 */
export function startOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  // Sunday = 0, Monday = 1, ..., Saturday = 6
  // We want Monday as start, so shift: Mon=0, Tue=1, ..., Sun=6
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - diff);
  return formatDate(d);
}

/**
 * Get the Friday of the week containing the given date.
 */
export function endOfWeek(date: Date = new Date()): string {
  const monday = parseDate(startOfWeek(date));
  monday.setDate(monday.getDate() + 4); // Friday
  return formatDate(monday);
}

/**
 * Get the ISO week number for a date.
 * Returns format: "2026-W21"
 */
export function weekNumber(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday (ISO week date algorithm)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Get the start and end of the previous working week (Monday–Friday).
 */
export function lastWorkingWeek(): { from: string; to: string } {
  const now = new Date();
  const thisMonday = parseDate(startOfWeek(now));
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastFriday.getDate() + 4);
  return {
    from: formatDate(lastMonday),
    to: formatDate(lastFriday),
  };
}

/**
 * Get the start and end of the current working week (Monday–Friday).
 */
export function currentWorkingWeek(): { from: string; to: string } {
  const now = new Date();
  return {
    from: startOfWeek(now),
    to: endOfWeek(now),
  };
}

/**
 * Check if a date string falls within a range (inclusive).
 */
export function isInRange(
  dateStr: string,
  from: string,
  to: string
): boolean {
  return dateStr >= from && dateStr <= to;
}

/**
 * Get a human-readable description of a date range.
 * E.g., "May 19 – May 23, 2026"
 */
export function describeRange(from: string, to: string): string {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const fromMonth = months[fromDate.getMonth()]!;
  const toMonth = months[toDate.getMonth()]!;
  const fromDay = fromDate.getDate();
  const toDay = toDate.getDate();
  const year = toDate.getFullYear();

  if (fromMonth === toMonth) {
    return `${fromMonth} ${fromDay} – ${toDay}, ${year}`;
  }
  return `${fromMonth} ${fromDay} – ${toMonth} ${toDay}, ${year}`;
}

/**
 * Check if two date strings represent the same day.
 */
export function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}
