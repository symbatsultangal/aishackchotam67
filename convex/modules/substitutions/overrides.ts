import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;

const getBaseRowsRef = publicRef<
  "query",
  { teacherId: Id<"staff">; lessons: number[] },
  Doc<"scheduleTemplates">[]
>("modules/substitutions/overrides:_getBaseRowsForTeacherLessons");

type ApplyOverrideArgs = {
  requestId: Id<"substitutionRequests">;
  candidateStaffId: Id<"staff">;
};

type GetBaseRowsArgs = {
  teacherId: Id<"staff">;
  lessons: number[];
};

export const applyOverride = mutation({
  args: {
    requestId: v.id("substitutionRequests"),
    candidateStaffId: v.id("staff"),
  },
  handler: async (ctx: MutationCtx, args: ApplyOverrideArgs) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Substitution request not found");
    }

    const baseRows = await ctx.runQuery(getBaseRowsRef, {
      teacherId: request.absentTeacherId,
      lessons: request.lessons,
    });

    const overrideIds: Id<"scheduleOverrides">[] = [];
    for (const row of baseRows) {
      overrideIds.push(
        await ctx.db.insert("scheduleOverrides", {
          schoolId: request.schoolId,
          date: request.date,
          classId: row.classId,
          lessonNumber: row.lessonNumber,
          subject: row.subject,
          originalTeacherId: row.teacherId,
          substituteTeacherId: args.candidateStaffId,
          roomId: row.roomId,
          reason: request.reason,
          requestId: request._id,
          status: "applied",
        }),
      );
    }

    await ctx.db.patch(request._id, {
      status: "applied",
    });

    return overrideIds;
  },
});

export const _getBaseRowsForTeacherLessons = query({
  args: {
    teacherId: v.id("staff"),
    lessons: v.array(v.number()),
  },
  handler: async (ctx: QueryCtx, args: GetBaseRowsArgs) => {
    const rows = await ctx.db
      .query("scheduleTemplates")
      .withIndex("by_teacher_weekday_lesson", (q: any) => q.eq("teacherId", args.teacherId))
      .collect();
    return rows.filter((row: any) => args.lessons.includes(row.lessonNumber));
  },
});
