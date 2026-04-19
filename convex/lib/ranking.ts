export type SubstitutionRequestContext = {
  subject: string;
  grade: string;
  roomId: string;
  lessonNumber: number;
  date: string;
  // P0-1: multi-lesson absences can cover more than one lesson. Scoring now
  // evaluates the candidate across all of them; the single-lesson fields
  // above are preserved for backwards-compatibility with older tests.
  lessons?: Array<{ lessonNumber: number; subject: string; roomId: string }>;
};

export type SubstitutionCandidate = {
  staffId: string;
  displayName: string;
  subjects: string[];
  grades: string[];
  qualifications: string[];
  isFree: boolean;
  roomAvailable: boolean;
  dailyAssignedLessons: number;
  // P0-1: optional diagnostic reasons surfaced from the planner (e.g. which
  // specific lesson/room conflicted).
  conflictReasons?: string[];
};

export type RankedCandidate = SubstitutionCandidate & {
  score: number;
  eligible: boolean;
  reasons: string[];
};

export function rankSubstitutionCandidates(
  context: SubstitutionRequestContext,
  candidates: SubstitutionCandidate[],
): RankedCandidate[] {
  return candidates
    .map((candidate) => {
      let score = 0;
      const reasons: string[] = [];

      // P0-1: multi-lesson subject/grade scoring. Award the subject-match
      // bonus per distinct lesson subject the candidate can cover.
      const lessons =
        context.lessons && context.lessons.length > 0
          ? context.lessons
          : [
              {
                lessonNumber: context.lessonNumber,
                subject: context.subject,
                roomId: context.roomId,
              },
            ];
      const distinctSubjects = Array.from(
        new Set(lessons.map((lesson) => lesson.subject).filter(Boolean)),
      );
      const subjectCoverage = distinctSubjects.filter((subject) =>
        candidate.subjects.includes(subject),
      ).length;
      const gradeMatch = candidate.grades.includes(context.grade);

      if (!candidate.isFree) {
        reasons.push("Teacher is not free during the requested lesson");
      } else {
        score += 40;
      }

      if (!candidate.roomAvailable) {
        reasons.push("Assigned room is not available");
        if (candidate.conflictReasons && candidate.conflictReasons.length > 0) {
          for (const conflictReason of candidate.conflictReasons) {
            reasons.push(conflictReason);
          }
        }
      } else {
        score += 10;
      }

      if (subjectCoverage > 0) {
        // Award the full 30 for any match, plus a smaller bonus per additional
        // covered subject (multi-lesson absences benefit from broad coverage).
        score += 30 + Math.max(0, subjectCoverage - 1) * 10;
        reasons.push(
          subjectCoverage === distinctSubjects.length
            ? "Subject qualification match"
            : `Partial subject coverage (${subjectCoverage}/${distinctSubjects.length})`,
        );
      }

      if (gradeMatch) {
        score += 20;
        reasons.push("Grade familiarity match");
      }

      if (candidate.qualifications.length > 0) {
        score += 10;
        reasons.push("Has explicit qualifications");
      }

      score -= candidate.dailyAssignedLessons * 3;

      return {
        ...candidate,
        score,
        eligible: candidate.isFree && candidate.roomAvailable,
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score);
}
