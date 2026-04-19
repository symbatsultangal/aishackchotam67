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

  test("room-conflicted candidate is ineligible even when free and subject-matching", () => {
    const context: SubstitutionRequestContext = {
      subject: "Physics",
      grade: "5",
      roomId: "room-lab",
      lessonNumber: 3,
      date: "2026-04-18",
      lessons: [
        { lessonNumber: 3, subject: "Physics", roomId: "room-lab" },
        { lessonNumber: 4, subject: "Chemistry", roomId: "room-lab" },
      ],
    };

    const candidates: SubstitutionCandidate[] = [
      {
        staffId: "teacher-room-blocked",
        displayName: "Room Blocked",
        subjects: ["Physics", "Chemistry"],
        grades: ["5"],
        qualifications: ["science-specialist"],
        isFree: true,
        roomAvailable: false,
        dailyAssignedLessons: 1,
        conflictReasons: ["Room occupied during lesson(s) 3, 4"],
      },
      {
        staffId: "teacher-clear",
        displayName: "All Clear",
        subjects: ["Physics"],
        grades: ["5"],
        qualifications: [],
        isFree: true,
        roomAvailable: true,
        dailyAssignedLessons: 2,
      },
    ];

    const result = rankSubstitutionCandidates(context, candidates);
    const blocked = result.find((c) => c.staffId === "teacher-room-blocked")!;
    const clear = result.find((c) => c.staffId === "teacher-clear")!;

    expect(blocked.eligible).toBe(false);
    expect(blocked.reasons).toContain("Assigned room is not available");
    expect(clear.eligible).toBe(true);
    // An eligible candidate should always be preferred over an ineligible one,
    // regardless of raw score — eligibility is a hard filter.
    expect(result.filter((c) => c.eligible)[0].staffId).toBe("teacher-clear");
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
