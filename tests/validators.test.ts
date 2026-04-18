import { describe, expect, test } from "vitest";

import {
  normalizeTeacherExtraction,
  validateTeacherExtraction,
} from "../convex/lib/validators";

describe("validateTeacherExtraction", () => {
  test("accepts a valid attendance extraction payload", () => {
    const result = validateTeacherExtraction({
      kind: "attendance",
      classCode: "1A",
      presentCount: 24,
      absentCount: 2,
      confidence: 0.91,
    });

    expect(result.ok).toBe(true);
  });

  test("rejects attendance data with negative counts", () => {
    const result = validateTeacherExtraction({
      kind: "attendance",
      classCode: "1A",
      presentCount: -1,
      absentCount: 2,
      confidence: 0.91,
    });

    expect(result.ok).toBe(false);
  });

  test("normalizes a low-detail incident into the expected shape", () => {
    const normalized = normalizeTeacherExtraction({
      kind: "incident",
      title: "Broken desk",
      description: "Desk broken in room 12",
      location: "Room 12",
    });

    expect(normalized).toMatchObject({
      kind: "incident",
      severity: "medium",
      category: "facilities",
      location: "Room 12",
    });
  });
});
