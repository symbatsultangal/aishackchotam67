import { describe, expect, test, vi } from "vitest";

import {
  hasCutoffPassed,
  isSameSchoolDate,
  schoolDateParts,
} from "../convex/lib/time";

describe("schoolDateParts", () => {
  test("maps a UTC instant into the school's local date and hour", () => {
    const result = schoolDateParts(
      "2026-04-18T03:15:00.000Z",
      "Asia/Qyzylorda",
    );

    expect(result).toMatchObject({
      date: "2026-04-18",
      hour: 8,
      minute: 15,
    });
  });
});

describe("hasCutoffPassed", () => {
  test("returns true once the local school time reaches the summary cutoff", () => {
    expect(
      hasCutoffPassed("2026-04-18T04:00:00.000Z", "Asia/Qyzylorda", 9, 0),
    ).toBe(true);
  });

  test("returns false before the local school cutoff", () => {
    expect(
      hasCutoffPassed("2026-04-18T03:30:00.000Z", "Asia/Qyzylorda", 9, 0),
    ).toBe(false);
  });
});

describe("isSameSchoolDate", () => {
  test("compares dates using the school's timezone rather than UTC", () => {
    expect(
      isSameSchoolDate(
        "2026-04-17T20:30:00.000Z",
        "2026-04-18",
        "Asia/Qyzylorda",
      ),
    ).toBe(true);
  });
});
