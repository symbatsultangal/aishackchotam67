export type SubstitutionRequestContext = {
  subject: string;
  grade: string;
  roomId: string;
  lessonNumber: number;
  date: string;
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
      const subjectMatch = candidate.subjects.includes(context.subject);
      const gradeMatch = candidate.grades.includes(context.grade);

      if (!candidate.isFree) {
        reasons.push("Teacher is not free during the requested lesson");
      } else {
        score += 40;
      }

      if (!candidate.roomAvailable) {
        reasons.push("Assigned room is not available");
      } else {
        score += 10;
      }

      if (subjectMatch) {
        score += 30;
        reasons.push("Subject qualification match");
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
