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

const getTemplateForTeacherLessonRef = publicRef<
  "query",
  { teacherId: Id<"staff">; lessonNumber: number },
  Doc<"scheduleTemplates"> | null
>("modules/substitutions/planner:_getTemplateForTeacherLesson");

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

const getTeacherOverridesForDateRef = publicRef<
  "query",
  { schoolId: Id<"schools">; date: string },
  Doc<"scheduleOverrides">[]
>("modules/substitutions/planner:_getTeacherOverridesForDate");

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

type GetTeacherArgs = {
  teacherId: Id<"staff">;
};

type GetTemplateForTeacherLessonArgs = {
  teacherId: Id<"staff">;
  lessonNumber: number;
};

type GetTeacherOverridesForDateArgs = {
  schoolId: Id<"schools">;
  date: string;
};

type GetScheduleRowsForWeekdayArgs = {
  schoolId: Id<"schools">;
  weekday: number;
};

type GetClassByIdArgs = {
  classId: Id<"classes">;
};

type SaveCandidatesArgs = {
  requestId: Id<"substitutionRequests">;
  chosenCandidates: Array<{
    staffId: Id<"staff">;
    score: number;
    eligible: boolean;
    reasons: string[];
  }>;
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

    const scheduleRow = await ctx.runQuery(
      getTemplateForTeacherLessonRef,
      {
        teacherId: request.absentTeacherId,
        lessonNumber: request.lessons[0],
      },
    );
    if (!scheduleRow) {
      throw new Error("No schedule row found for absent teacher lesson");
    }

    const classDoc = await ctx.runQuery(getClassByIdRef, {
      classId: scheduleRow.classId,
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
    const overrides = await ctx.runQuery(
      getTeacherOverridesForDateRef,
      {
        schoolId: request.schoolId,
        date: request.date,
      },
    );

    const candidates: SubstitutionCandidate[] = staff
      .filter((member: any) => member._id !== request.absentTeacherId)
      .map((member: any) => {
        const alreadyAssignedOverride = overrides.some(
          (override: any) =>
            override.substituteTeacherId === member._id &&
            request.lessons.includes(override.lessonNumber),
        );
        const baseConflictRows = baseScheduleRows.filter(
          (row: any) => row.teacherId === member._id &&
          request.lessons.includes(row.lessonNumber),
        );

        return {
          staffId: member._id,
          displayName: member.displayName,
          subjects: member.subjects,
          grades: member.grades,
          qualifications: member.qualifications,
          isFree: baseConflictRows.length === 0 && !alreadyAssignedOverride,
          roomAvailable: true,
          dailyAssignedLessons: baseScheduleRows.filter((row: any) => row.teacherId === member._id)
            .length,
        };
      });

    const context: SubstitutionRequestContext = {
      subject: scheduleRow.subject,
      grade: classDoc?.grade ?? "",
      roomId: scheduleRow.roomId,
      lessonNumber: request.lessons[0],
      date: request.date,
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
  handler: async (ctx: QueryCtx, args: GetTeacherArgs) => ctx.db.get(args.teacherId),
});

export const _getTemplateForTeacherLesson = query({
  args: {
    teacherId: v.id("staff"),
    lessonNumber: v.number(),
  },
  handler: async (ctx: QueryCtx, args: GetTemplateForTeacherLessonArgs) => {
    const rows = await ctx.db
      .query("scheduleTemplates")
      .withIndex("by_teacher_weekday_lesson", (q: any) => q.eq("teacherId", args.teacherId))
      .collect();
    return rows.find((row: any) => row.lessonNumber === args.lessonNumber) ?? null;
  },
});

export const _getTeacherOverridesForDate = query({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
  },
  handler: async (ctx: QueryCtx, args: GetTeacherOverridesForDateArgs) => {
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
  handler: async (ctx: QueryCtx, args: GetScheduleRowsForWeekdayArgs) => {
    const rows = await ctx.db.query("scheduleTemplates").collect();
    return rows.filter(
      (row: any) => row.schoolId === args.schoolId && row.weekday === args.weekday,
    );
  },
});

export const _getClassById = query({
  args: {
    classId: v.id("classes"),
  },
  handler: async (ctx: QueryCtx, args: GetClassByIdArgs) => ctx.db.get(args.classId),
});

export const _saveCandidates = mutation({
  args: {
    requestId: v.id("substitutionRequests"),
    chosenCandidates: v.array(substitutionCandidateValidator),
  },
  handler: async (ctx: MutationCtx, args: SaveCandidatesArgs) => {
    await ctx.db.patch(args.requestId, {
      chosenCandidates: args.chosenCandidates,
      status: "ranked",
    });
    return args.requestId;
  },
});
