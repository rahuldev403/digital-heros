/**
 * Draw periods.
 *
 * Draws run on a monthly cadence (PRD §06), so a period is identified by the
 * string "YYYY-MM". A string rather than a date because it is an exact,
 * sortable, human-readable key that cannot drift by a timezone: "2026-03" means
 * March 2026 to every process that reads it.
 *
 * All period maths is done in UTC. The alternative — the server's local zone —
 * would mean a draw could land in a different month depending on where it was
 * deployed.
 */

export type PeriodKey = string;

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPeriodKey(value: string): boolean {
  return PERIOD_PATTERN.test(value);
}

/** Formats a date as its period key, e.g. 2026-03-14 → "2026-03". */
export function toPeriodKey(date: Date = new Date()): PeriodKey {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

/** Current period. */
export function currentPeriodKey(): PeriodKey {
  return toPeriodKey(new Date());
}

/** Shifts a period key by a number of months, forward or back. */
export function shiftPeriodKey(periodKey: PeriodKey, months: number): PeriodKey {
  const { year, month } = parsePeriodKey(periodKey);
  // Date handles the year rollover for us: month index 12 becomes January next.
  return toPeriodKey(new Date(Date.UTC(year, month - 1 + months, 1)));
}

export function parsePeriodKey(periodKey: PeriodKey): { year: number; month: number } {
  if (!isValidPeriodKey(periodKey)) {
    throw new Error(`Invalid period key: "${periodKey}". Expected "YYYY-MM".`);
  }

  const [year, month] = periodKey.split("-").map(Number);

  return { year, month };
}

/** First instant of the period (inclusive). */
export function periodStart(periodKey: PeriodKey): Date {
  const { year, month } = parsePeriodKey(periodKey);
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

/** First instant of the *next* period — use as an exclusive upper bound. */
export function periodEnd(periodKey: PeriodKey): Date {
  const { year, month } = parsePeriodKey(periodKey);
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

/**
 * When the draw for a period takes place: the last day of that month, 18:00 UTC.
 * Entries are locked at this moment.
 */
export function periodDrawDate(periodKey: PeriodKey): Date {
  const { year, month } = parsePeriodKey(periodKey);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return new Date(Date.UTC(year, month - 1, lastDay, 18, 0, 0, 0));
}

/** Human label for a period, e.g. "March 2026". */
export function formatPeriod(periodKey: PeriodKey): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(periodStart(periodKey));
}
