import { describe, expect, test } from "vitest";

import {
  matchStaffByName,
  levenshtein,
  type StaffLike,
} from "../convex/lib/nameMatching";

const pool: StaffLike[] = [
  { _id: "s1", displayName: "Айгерим", fullName: "Айгерим Есентаева" },
  { _id: "s2", displayName: "Марат", fullName: "Марат Нурланов" },
  { _id: "s3", displayName: "Марат Б.", fullName: "Марат Бекенов" },
  { _id: "s4", displayName: "Назкен", fullName: "Назкен Ахметова" },
  { _id: "s5", displayName: "Гүлнар", fullName: "Гүлнар Жұмабаева" },
];

describe("matchStaffByName", () => {
  test("exact match on fullName (case-insensitive)", () => {
    const result = matchStaffByName("айгерим есентаева", pool);
    expect(result.confidence).toBe("exact");
    expect(result.staff?._id).toBe("s1");
  });

  test("exact match on displayName", () => {
    const result = matchStaffByName("Назкен", pool);
    expect(result.confidence).toBe("exact");
    expect(result.staff?._id).toBe("s4");
  });

  test("fuzzy first-name match when unique", () => {
    const result = matchStaffByName("Айгерим", pool);
    expect(result.confidence).toBe("exact");
    expect(result.staff?._id).toBe("s1");
  });

  test("ambiguous first-name returns none with multiple candidates", () => {
    // "Марат" exactly matches displayName of s2, so we need a pool
    // where two people share a first name but neither displayName matches exactly.
    const ambiguousPool: StaffLike[] = [
      { _id: "m1", displayName: "Марат Н.", fullName: "Марат Нурланов" },
      { _id: "m2", displayName: "Марат Б.", fullName: "Марат Бекенов" },
      { _id: "m3", displayName: "Айгерим", fullName: "Айгерим Есентаева" },
    ];
    const result = matchStaffByName("Марат", ambiguousPool);
    expect(result.confidence).toBe("none");
    expect(result.staff).toBeNull();
    expect(result.candidates.length).toBe(2);
    const ids = result.candidates.map((c) => c._id).sort();
    expect(ids).toEqual(["m1", "m2"]);
  });

  test("empty query returns none with no candidates", () => {
    const result = matchStaffByName("", pool);
    expect(result.confidence).toBe("none");
    expect(result.staff).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });

  test("completely unrelated name returns close matches by Levenshtein", () => {
    const result = matchStaffByName("Гулнар", pool);
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});

describe("levenshtein", () => {
  test("identical strings have distance 0", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  test("single character difference", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });

  test("empty vs non-empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  test("cyrillic strings", () => {
    expect(levenshtein("марат", "марат")).toBe(0);
    expect(levenshtein("марат", "марак")).toBe(1);
  });
});
