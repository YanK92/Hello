import { describe, expect, it } from "vitest";
import { calendarDaysBetween, londonDate } from "./dates";

describe("londonDate", () => {
  it("uses the UK calendar day, not the UTC one", () => {
    // 23:30 UTC in July is 00:30 the next day in London (BST).
    expect(londonDate("2026-07-01T23:30:00Z")).toEqual({ year: 2026, month: 7, day: 2 });
    // In winter London is on GMT, so the day is the same.
    expect(londonDate("2026-01-01T23:30:00Z")).toEqual({ year: 2026, month: 1, day: 1 });
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days in either order", () => {
    expect(calendarDaysBetween("2026-09-01T09:00:00Z", "2026-09-15T17:00:00Z")).toBe(14);
    expect(calendarDaysBetween("2026-09-15T17:00:00Z", "2026-09-01T09:00:00Z")).toBe(14);
  });

  it("is 0 for two entries on the same day", () => {
    expect(calendarDaysBetween("2026-09-01T00:05:00+01:00", "2026-09-01T23:55:00+01:00")).toBe(0);
  });

  it("is not thrown off when the clocks go forward or back", () => {
    // Clocks go forward 29 March 2026 and back 25 October 2026.
    expect(calendarDaysBetween("2026-03-28T12:00:00Z", "2026-03-30T12:00:00+01:00")).toBe(2);
    expect(calendarDaysBetween("2026-10-24T12:00:00+01:00", "2026-10-26T12:00:00Z")).toBe(2);
    expect(calendarDaysBetween("2026-03-01T00:30:00Z", "2026-11-01T00:30:00Z")).toBe(245);
  });

  it("handles month ends and leap years", () => {
    expect(calendarDaysBetween("2026-01-31T10:00:00Z", "2026-03-01T10:00:00Z")).toBe(29);
    expect(calendarDaysBetween("2028-02-28T10:00:00Z", "2028-03-01T10:00:00Z")).toBe(2);
  });
});
