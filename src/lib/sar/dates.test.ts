import { describe, expect, it } from "vitest";
import { addCalendarMonths, daysUntil, sarDueDates } from "./dates";

describe("addCalendarMonths (ICO method)", () => {
  it("uses the corresponding date in the next month", () => {
    expect(addCalendarMonths("2026-05-14", 1)).toBe("2026-06-14");
  });

  it("uses the last day of the month when that date does not exist", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addCalendarMonths("2026-03-31", 1)).toBe("2026-04-30");
    expect(addCalendarMonths("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("crosses the year end", () => {
    expect(addCalendarMonths("2026-12-30", 1)).toBe("2027-01-30");
    expect(addCalendarMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("is unaffected by the clocks changing", () => {
    // Clocks go forward 29 March 2026 and back 25 October 2026.
    expect(addCalendarMonths("2026-03-29", 1)).toBe("2026-04-29");
    expect(addCalendarMonths("2026-10-25", 1)).toBe("2026-11-25");
    expect(addCalendarMonths("2026-09-28", 1)).toBe("2026-10-28");
  });

  it("rejects malformed dates", () => {
    expect(() => addCalendarMonths("2026-02-30", 1)).toThrow();
    expect(() => addCalendarMonths("14/05/2026", 1)).toThrow();
  });
});

describe("sarDueDates", () => {
  it("counts from when the organisation received it, if known, otherwise from sending", () => {
    expect(sarDueDates({ sentOn: "2026-05-12", receivedOn: "2026-05-14" })).toEqual({
      startsOn: "2026-05-14",
      dueOn: "2026-06-14",
      extendedDueOn: "2026-08-14",
    });
    expect(sarDueDates({ sentOn: "2026-08-07", receivedOn: null })).toEqual({
      startsOn: "2026-08-07",
      dueOn: "2026-09-07",
      extendedDueOn: "2026-11-07",
    });
  });
});

describe("daysUntil", () => {
  it("counts UK calendar days from today to a date", () => {
    expect(daysUntil("2026-06-14", new Date("2026-06-01T10:00:00Z"))).toBe(13);
    expect(daysUntil("2026-06-14", new Date("2026-06-14T23:30:00Z"))).toBe(-1); // 00:30 on 15 June in the UK
    expect(daysUntil("2026-06-14", new Date("2026-06-20T09:00:00Z"))).toBe(-6);
  });
});
