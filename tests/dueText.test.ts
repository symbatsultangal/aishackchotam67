import { describe, expect, test } from "vitest";

import { parseDueText } from "../convex/lib/dueDate";

const TZ = "Asia/Aqtau";
const REF = "2026-04-20T10:00:00Z";

describe("parseDueText", () => {
  test("returns null for empty/undefined input", () => {
    expect(parseDueText(undefined, REF, TZ)).toBeNull();
    expect(parseDueText("", REF, TZ)).toBeNull();
    expect(parseDueText("   ", REF, TZ)).toBeNull();
  });

  test("passes through valid ISO string", () => {
    const result = parseDueText("2026-04-22T10:00:00Z", REF, TZ);
    expect(result).toBe("2026-04-22T10:00:00.000Z");
  });

  test("passes through ISO date (no time)", () => {
    const result = parseDueText("2026-04-22", REF, TZ);
    expect(result).not.toBeNull();
    expect(result).toContain("2026-04-22");
  });

  test("parses 'сегодня 14:00' to today at 14:00 local", () => {
    const result = parseDueText("сегодня 14:00", REF, TZ);
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getTime()).not.toBeNaN();
    // Aqtau is UTC+5, so 14:00 local = 09:00 UTC
    expect(date.getUTCHours()).toBe(9);
  });

  test("parses 'завтра' to next day with default 17:00", () => {
    const result = parseDueText("завтра", REF, TZ);
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getTime()).not.toBeNaN();
    // Should be April 21 (tomorrow from April 20)
    expect(date.toISOString()).toContain("2026-04-21");
  });

  test("parses 'tomorrow 9:30' to next day at specified time", () => {
    const result = parseDueText("tomorrow 9:30", REF, TZ);
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getTime()).not.toBeNaN();
  });

  test("parses 'в пятницу' to next Friday", () => {
    // April 20 2026 is Monday (weekday 1), so Friday is +4 days = April 24
    const result = parseDueText("в пятницу", REF, TZ);
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getTime()).not.toBeNaN();
    expect(date.getUTCDay()).toBe(5);
  });

  test("parses 'через 3 дня'", () => {
    const result = parseDueText("через 3 дня", REF, TZ);
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.toISOString().slice(0, 10)).toBe("2026-04-23");
  });

  test("parses plain HH:MM as today", () => {
    const result = parseDueText("14:00", REF, TZ);
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getTime()).not.toBeNaN();
  });

  test("returns null for unrecognized text", () => {
    expect(parseDueText("как-нибудь потом", REF, TZ)).toBeNull();
    expect(parseDueText("random garbage", REF, TZ)).toBeNull();
  });
});
