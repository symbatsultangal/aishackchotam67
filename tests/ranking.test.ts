import { describe, expect, test } from "vitest";

import {
  rankSubstitutionCandidates,
  type SubstitutionCandidate,
  type SubstitutionRequestContext,
} from "../convex/lib/ranking";

describe("rankSubstitutionCandidates", () => {
  test("prefers qualified and conflict-free teachers over weaker matches", () => {
    const context: SubstitutionRequestContext = {
      subject: "Math",
      grade: "3",
      roomId: "room-3",
      lessonNumber: 2,
      date: "2026-04-18",
    };

    const candidates: SubstitutionCandidate[] = [
      {
        staffId: "teacher-a",
        displayName: "Aigerim",
        subjects: ["Math"],
        grades: ["3", "4"],
        qualifications: ["math-specialist"],
        isFree: true,
        roomAvailable: true,
        dailyAssignedLessons: 2,
      },
      {
        staffId: "teacher-b",
        displayName: "Nazken",
        subjects: ["English"],
        grades: ["3"],
        qualifications: ["assistant"],
        isFree: true,
        roomAvailable: true,
        dailyAssignedLessons: 0,
      },
      {
        staffId: "teacher-c",
        displayName: "Askar",
        subjects: ["Math"],
        grades: ["3"],
        qualifications: ["math-specialist"],
        isFree: false,
        roomAvailable: true,
        dailyAssignedLessons: 0,
      },
    ];

    const result = rankSubstitutionCandidates(context, candidates);

    expect(result[0]).toMatchObject({
      staffId: "teacher-a",
      eligible: true,
    });
    expect(result[1].eligible).toBe(true);
    expect(result[2].eligible).toBe(false);
  });

  test("penalizes busy teachers when qualifications are otherwise similar", () => {
    const context: SubstitutionRequestContext = {
      subject: "English",
      grade: "2",
      roomId: "room-2",
      lessonNumber: 4,
      date: "2026-04-18",
    };

    const candidates: SubstitutionCandidate[] = [
      {
        staffId: "teacher-busy",
        displayName: "Busy Teacher",
        subjects: ["English"],
        grades: ["2"],
        qualifications: [],
        isFree: true,
        roomAvailable: true,
        dailyAssignedLessons: 6,
      },
      {
        staffId: "teacher-light",
        displayName: "Light Teacher",
        subjects: ["English"],
        grades: ["2"],
        qualifications: [],
        isFree: true,
        roomAvailable: true,
        dailyAssignedLessons: 1,
      },
    ];

    const result = rankSubstitutionCandidates(context, candidates);

    expect(result[0].staffId).toBe("teacher-light");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });
});
