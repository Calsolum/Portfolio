import { WEEKDAYS, type Weekday } from "../types";

export const DAY_SHORT: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const DAY_LONG: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Date#getDay counts from Sunday. */
const BY_JS_DAY: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** The weekday on the visitor's own clock, so "today" is today for them. */
export function weekdayOf(date: Date): Weekday {
  return BY_JS_DAY[date.getDay()];
}

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
}

/** "Wed", "Mon–Fri", "Tue, Thu", "Every day". Runs of three or more days are collapsed. */
export function describeDays(days: readonly Weekday[]): string {
  const on = WEEKDAYS.map((day) => days.includes(day));
  if (on.every(Boolean)) return "Every day";

  const parts: string[] = [];
  let i = 0;
  while (i < WEEKDAYS.length) {
    if (!on[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < WEEKDAYS.length && on[j + 1]) j += 1;
    if (j - i >= 2) {
      parts.push(`${DAY_SHORT[WEEKDAYS[i]]}–${DAY_SHORT[WEEKDAYS[j]]}`);
    } else {
      for (let k = i; k <= j; k += 1) parts.push(DAY_SHORT[WEEKDAYS[k]]);
    }
    i = j + 1;
  }
  return parts.join(", ");
}
