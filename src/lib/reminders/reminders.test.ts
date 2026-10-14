import { describe, expect, it, vi } from "vitest";
import { findBannedPhrases, loadPhrases } from "../../../scripts/copy-lint.mjs";
import { processDueReminders, reminderEmail, sarReminderSchedule, ukTimeOn, type DueReminder } from "./reminders";

describe("ukTimeOn", () => {
  it("gives 08:00 UK time as UTC, in winter and summer", () => {
    expect(ukTimeOn("2026-01-15", 8)).toBe("2026-01-15T08:00:00.000Z");
    expect(ukTimeOn("2026-06-15", 8)).toBe("2026-06-15T07:00:00.000Z");
  });

  it("handles the days the clocks change", () => {
    expect(ukTimeOn("2026-03-29", 8)).toBe("2026-03-29T07:00:00.000Z");
    expect(ukTimeOn("2026-10-25", 8)).toBe("2026-10-25T08:00:00.000Z");
  });
});

describe("sarReminderSchedule", () => {
  it("reminds on the due date and seven days after", () => {
    expect(sarReminderSchedule("2026-02-28")).toEqual([
      { kind: "sar_due", dueAt: "2026-02-28T08:00:00.000Z" },
      { kind: "sar_followup", dueAt: "2026-03-07T08:00:00.000Z" },
    ]);
  });
});

const reminder = (over: Partial<DueReminder> = {}): DueReminder => ({
  id: "r1",
  kind: "sar_due",
  userId: "u1",
  caseId: "c1",
  caseTitle: "Car",
  recipient: "Example Finance",
  dueOn: "2026-02-28",
  sarStatus: "sent",
  ...over,
});

describe("reminderEmail", () => {
  it("is factual and links to the case", () => {
    const { subject, text } = reminderEmail(reminder(), "https://app.example/cases/c1/sar");
    expect(subject).toBe("Reminder: SAR response date for Example Finance");
    expect(text).toContain("28 February 2026");
    expect(text).toContain("https://app.example/cases/c1/sar");
    expect(findBannedPhrases(text, loadPhrases())).toEqual([]);
  });

  it("words the follow-up as a date record, not a judgement", () => {
    const { text } = reminderEmail(reminder({ kind: "sar_followup" }), "https://x");
    expect(text).toContain("7 days after the response date you recorded");
  });
});

describe("processDueReminders", () => {
  function deps(overrides = {}) {
    return {
      due: vi.fn(async () => [reminder(), reminder({ id: "r2", userId: "u2" }), reminder({ id: "r3", sarStatus: "response_received" })]),
      contact: vi.fn(async (userId: string) => (userId === "u1" ? { email: "a@example.test", optedIn: true } : { email: "b@example.test", optedIn: false })),
      send: vi.fn<(to: string, subject: string, text: string) => Promise<void>>(async () => {}),
      markSent: vi.fn<(id: string) => Promise<void>>(async () => {}),
      baseUrl: "https://app.example",
      ...overrides,
    };
  }

  it("emails opted-in users, and settles the rest without emailing", async () => {
    const d = deps();
    const result = await processDueReminders(d);
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(d.send).toHaveBeenCalledWith("a@example.test", expect.any(String), expect.stringContaining("/cases/c1/sar"));
    expect(d.markSent.mock.calls.map((c) => c[0]).sort()).toEqual(["r1", "r2", "r3"]);
    expect(result).toEqual({ sent: 1, skipped: 2, failed: 0 });
  });

  it("leaves a reminder unsent if the email fails, so it is retried next run", async () => {
    const d = deps({ send: vi.fn(async () => { throw new Error("down"); }) });
    const result = await processDueReminders(d);
    expect(d.markSent).not.toHaveBeenCalledWith("r1");
    expect(result.failed).toBe(1);
  });
});
