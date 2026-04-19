import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";
import {
  rankSubstitutionCandidates,
  type SubstitutionCandidate,
  type SubstitutionRequestContext,
} from "../../lib/ranking";
import {
  buildOccupancyMaps,
  vacateTeacher,
  checkCandidateConflicts,
} from "../../lib/scheduleConflicts";
import { substitutionCandidateValidator } from "../../lib/validators";

const action: any = actionGeneric;
const mutation: any = mutationGeneric;
const query: any = queryGeneric;

const getRequestRef = publicRef<
  "query",
  { requestId: Id<"substitutionRequests"> },
  Doc<"substitutionRequests"> | null
>("modules/substitutions/requests:getRequest");

const getTeacherRef = publicRef<
  "query",
  { teacherId: Id<"staff"> },
  Doc<"staff"> | null
>("modules/substitutions/planner:_getTeacher");

const getTemplatesForTeacherDayRef = publicRef<
  "query",
  { teacherId: Id<"staff">; weekday: number; lessonNumbers: number[] },
  Doc<"scheduleTemplates">[]
>("modules/substitutions/planner:_getTemplatesForTeacherDay");

const getClassByIdRef = publicRef<
  "query",
  { classId: Id<"classes"> },
  Doc<"classes"> | null
>("modules/substitutions/planner:_getClassById");

const getScheduleRowsForWeekdayRef = publicRef<
  "query",
  { schoolId: Id<"schools">; weekday: number },
  Doc<"scheduleTemplates">[]
>("modules/substitutions/planner:_getScheduleRowsForWeekday");

const listAssignableStaffRef = publicRef<
  "query",
  { schoolId: Id<"schools">; activeOnly?: boolean },
  Doc<"staff">[]
>("modules/schoolCore/staff:listAssignable");

const getOverridesForDateRef = publicRef<
  "query",
  { schoolId: Id<"schools">; date: string },
  Doc<"scheduleOverrides">[]
>("modules/substitutions/planner:_getOverridesForDate");

const saveCandidatesRef = publicRef<
  "mutation",
  {
    requestId: Id<"substitutionRequests">;
    chosenCandidates: Array<{
      staffId: Id<"staff">;
      score: number;
      eligible: boolean;
      reasons: string[];
    }>;
  },
  Id<"substitutionRequests">
>("modules/substitutions/planner:_saveCandidates");

type RankCandidatesArgs = {
  requestId: Id<"substitutionRequests">;
};

export const rankCandidates = action({
  args: {
    requestId: v.id("substitutionRequests"),
  },
  handler: async (ctx: ActionCtx, args: RankCandidatesArgs) => {
    const request = await ctx.runQuery(getRequestRef, {
      requestId: args.requestId,
    });
    if (!request) {
      throw new Error("Substitution request not found");
    }

    const teacher = await ctx.runQuery(getTeacherRef, {
      teacherId: request.absentTeacherId,
    });
    if (!teacher) {
      throw new Error("Absent teacher not found");
    }

    // P0-1: look up every lesson the absent teacher covers today so ranking
    // context covers all requested lessons, not just lessons[0].
    const absentTeacherRows = await ctx.runQuery(getTemplatesForTeacherDayRef, {
      teacherId: request.absentTeacherId,
      weekday: new Date(`${request.date}T00:00:00Z`).getUTCDay(),
      lessonNumbers: request.lessons,
    });

    // Build ordered lesson slots used for scoring and conflict detection.
    const lessonSlots = request.lessons
      .map((lessonNumber: number) => {
        const row = absentTeacherRows.find(
          (candidateRow: any) => candidateRow.lessonNumber === lessonNumber,
        );
        return row
          ? {
              lessonNumber,
              subject: row.subject,
              roomId: String(row.roomId),
              classId: row.classId,
            }
          : null;
      })
      .filter(
        (slot): slot is {
          lessonNumber: number;
          subject: string;
          roomId: string;
          classId: Id<"classes">;
        } => slot !== null,
      );
    if (lessonSlots.length === 0) {
      throw new Error("No schedule rows found for absent teacher lessons");
    }

    const primarySlot = lessonSlots[0];
    const classDoc = await ctx.runQuery(getClassByIdRef, {
      classId: primarySlot.classId,
    });
    const weekday = new Date(`${request.date}T00:00:00Z`).getUTCDay();
    const baseScheduleRows = await ctx.runQuery(
      getScheduleRowsForWeekdayRef,
      {
        schoolId: request.schoolId,
        weekday,
      },
    );
    const staff = await ctx.runQuery(listAssignableStaffRef, {
      schoolId: request.schoolId,
      activeOnly: true,
    });
    const overrides = await ctx.runQuery(getOverridesForDateRef, {
      schoolId: request.schoolId,
      date: request.date,
    });
    const activeOverrides = overrides.filter((override: any) => override.status !== "canceled");

    const maps = buildOccupancyMaps(baseScheduleRows as any, activeOverrides as any);
    vacateTeacher(maps, request.absentTeacherId, lessonSlots);

    const candidates: SubstitutionCandidate[] = staff
      .filter((member: any) => member._id !== request.absentTeacherId)
      .map((member: any) => {
        const conflicts = checkCandidateConflicts(maps, member._id, lessonSlots);
        const dailyAssignedLessons = baseScheduleRows.filter(
          (row: any) => row.teacherId === member._id,
        ).length;

        return {
          staffId: member._id,
          displayName: member.displayName,
          subjects: member.subjects,
          grades: member.grades,
          qualifications: member.qualifications,
          isFree: conflicts.isFree,
          roomAvailable: conflicts.roomAvailable,
          dailyAssignedLessons,
          conflictReasons: conflicts.conflictReasons,
        };
      });

    const context: SubstitutionRequestContext = {
      subject: primarySlot.subject,
      grade: classDoc?.grade ?? "",
      roomId: primarySlot.roomId,
      lessonNumber: primarySlot.lessonNumber,
      date: request.date,
      lessons: lessonSlots.map((slot) => ({
        lessonNumber: slot.lessonNumber,
        subject: slot.subject,
        roomId: slot.roomId,
      })),
    };
    const ranked = rankSubstitutionCandidates(context, candidates);

    await ctx.runMutation(saveCandidatesRef, {
      requestId: request._id,
      chosenCandidates: ranked.slice(0, 5).map((candidate) => ({
        staffId: candidate.staffId as Id<"staff">,
        score: candidate.score,
        eligible: candidate.eligible,
        reasons: candidate.reasons,
      })),
    });

    return ranked;
  },
});

export const _getTeacher = query({
  args: {
    teacherId: v.id("staff"),
  },
  handler: async (ctx: QueryCtx, args: { teacherId: Id<"staff"> }) =>
    ctx.db.get(args.teacherId),
});

export const _getTemplatesForTeacherDay = query({
  args: {
    teacherId: v.id("staff"),
    weekday: v.number(),
    lessonNumbers: v.array(v.number()),
  },
  handler: async (
    ctx: QueryCtx,
    args: {
      teacherId: Id<"staff">;
      weekday: number;
      lessonNumbers: number[];
    },
  ) => {
    const rows = await ctx.db
      .query("scheduleTemplates")
      .withIndex("by_teacher_weekday_lesson", (q: any) => q.eq("teacherId", args.teacherId))
      .collect();
    return rows.filter(
      (row: any) =>
        row.weekday === args.weekday &&
        args.lessonNumbers.includes(row.lessonNumber),
    );
  },
});

// P0-1 preserves the old query name for any lingering callers, but now we
// return every override for the date, not just ones where the candidate is
// already a substitute. The planner needs the full picture to detect room
// conflicts introduced by earlier overrides.
export const _getOverridesForDate = query({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
  },
  handler: async (
    ctx: QueryCtx,
    args: { schoolId: Id<"schools">; date: string },
  ) => {
    return ctx.db
      .query("scheduleOverrides")
      .withIndex("by_school_date_class_lesson", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", args.date),
      )
      .collect();
  },
});

export const _getScheduleRowsForWeekday = query({
  args: {
    schoolId: v.id("schools"),
    weekday: v.number(),
  },
  handler: async (
    ctx: QueryCtx,
    args: { schoolId: Id<"schools">; weekday: number },
  ) => {
    const rows = await ctx.db.query("scheduleTemplates").collect();
    return rows.filter(
      (row: any) =>
        row.schoolId === args.schoolId && row.weekday === args.weekday,
    );
  },
});

export const _getClassById = query({
  args: {
    classId: v.id("classes"),
  },
  handler: async (ctx: QueryCtx, args: { classId: Id<"classes"> }) =>
    ctx.db.get(args.classId),
});

export const _saveCandidates = mutation({
  args: {
    requestId: v.id("substitutionRequests"),
    chosenCandidates: v.array(substitutionCandidateValidator),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      requestId: Id<"substitutionRequests">;
      chosenCandidates: Array<{
        staffId: Id<"staff">;
        score: number;
        eligible: boolean;
        reasons: string[];
      }>;
    },
  ) => {
    await ctx.db.patch(args.requestId, {
      chosenCandidates: args.chosenCandidates,
      status: "ranked",
    });
    return args.requestId;
  },
});
