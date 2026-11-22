import type { DevLogEntry } from "@/data/devlog";

export interface DevLogWeek {
  /** ISO date of the Monday that starts the week. */
  start: string;
  label: string;
  entries: DevLogEntry[];
}

export interface DevLogMonth {
  /** YYYY-MM. */
  key: string;
  label: string;
  weeks: DevLogWeek[];
}

// Entry dates are plain calendar days, so all date math happens in UTC
// to keep a day from shifting with the viewer's time zone.
function toDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return toDate(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...opts,
  });
}

function weekStart(iso: string) {
  const d = toDate(iso);
  const offset = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Newest first: months, then the weeks inside each month (weeks start on
 * Monday), then entries. A week that crosses a month boundary is split, so
 * each entry sits under the month it happened in.
 */
export function groupDevLog(entries: DevLogEntry[]): DevLogMonth[] {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const months: DevLogMonth[] = [];

  for (const entry of sorted) {
    const key = entry.date.slice(0, 7);
    let month = months.at(-1);
    if (!month || month.key !== key) {
      month = {
        key,
        label: toDate(`${key}-01`).toLocaleDateString("en-CA", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
        weeks: [],
      };
      months.push(month);
    }

    const start = weekStart(entry.date);
    let week = month.weeks.at(-1);
    if (!week || week.start !== start) {
      week = { start, label: `Week of ${formatDay(start)}`, entries: [] };
      month.weeks.push(week);
    }
    week.entries.push(entry);
  }

  return months;
}
