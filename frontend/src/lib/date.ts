// A bare `new Date("YYYY-MM-DD")` parses as UTC midnight and shifts a day in
// negative-UTC zones; split and build a local date to keep the intended day.
function localDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function addDays(iso: string, delta: number): string {
  const date = localDate(iso);
  date.setDate(date.getDate() + delta);
  return toIso(date);
}

export function formatGameTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Friday, July 10, 2026" (viewer's locale) from a date-only "YYYY-MM-DD". */
export function formatDisplayDate(iso: string): string {
  return localDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const FIRST_SEASON = 2010;

/** Selectable seasons, newest first (current year down to FIRST_SEASON). */
export function seasonList(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - FIRST_SEASON + 1 }, (_, i) => currentYear - i);
}

/** "Sat, June 15, 2024" from a date-only "YYYY-MM-DD". */
export function formatFullDate(isoDate: string): string {
  return localDate(isoDate).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** "Jun 15" from a date-only "YYYY-MM-DD". */
export function formatShortDate(isoDate: string): string {
  return localDate(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Sat, Jun 15" from a full ISO datetime. */
export function formatWeekdayDate(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** "June 2024" month-grouping key from a full ISO datetime. */
export function formatMonthYear(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
