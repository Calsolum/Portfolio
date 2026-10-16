import { describe, expect, it } from "vitest";

import { describeDays, isWeekday, weekdayOf } from "../lib/days";

describe("weekdayOf", () => {
  it("reads the day on the local clock", () => {
    expect(weekdayOf(new Date(2026, 9, 16, 12))).toBe("fri");
    expect(weekdayOf(new Date(2026, 9, 18, 23, 59))).toBe("sun");
    expect(weekdayOf(new Date(2026, 9, 19, 0, 1))).toBe("mon");
  });
});

describe("isWeekday", () => {
  it("accepts the seven codes only", () => {
    expect(isWeekday("wed")).toBe(true);
    expect(isWeekday("Wed")).toBe(false);
    expect(isWeekday("wednesday")).toBe(false);
    expect(isWeekday(3)).toBe(false);
  });
});

describe("describeDays", () => {
  it("names one day", () => {
    expect(describeDays(["wed"])).toBe("Wed");
  });

  it("collapses runs of three or more", () => {
    expect(describeDays(["mon", "tue", "wed", "thu", "fri"])).toBe("Mon–Fri");
    expect(describeDays(["fri", "sat", "sun"])).toBe("Fri–Sun");
  });

  it("lists pairs and gaps", () => {
    expect(describeDays(["mon", "tue"])).toBe("Mon, Tue");
    expect(describeDays(["tue", "thu"])).toBe("Tue, Thu");
    expect(describeDays(["mon", "wed", "thu", "fri"])).toBe("Mon, Wed–Fri");
  });

  it("puts days in week order whatever order they come in", () => {
    expect(describeDays(["sun", "mon"])).toBe("Mon, Sun");
  });

  it("says every day for all seven", () => {
    expect(describeDays(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).toBe("Every day");
  });
});
