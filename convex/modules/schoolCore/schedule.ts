import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { schoolDateParts } from "../../lib/time";
import { scheduleSeedEntryValidator } from "../../lib/validators";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;

type SeedArgs = {
  schoolId: Id<"schools">;
  entries: Array<{
    classId: Id<"classes">;
    weekday: number;
    lessonNumber: number;
    subject: string;
    teacherId: Id<"staff">;
    roomId: Id<"rooms">;
  }>;
};

type GetTodayArgs = {
  schoolId: Id<"schools">;
  nowIso?: string;
};

type GetClassDayArgs = {
  classId: Id<"classes">;
  weekday: number;
};

export const seed = mutation({
  args: {
    schoolId: v.id("schools"),
    entries: v.array(scheduleSeedEntryValidator),
  },
  handler: async (ctx: MutationCtx, args: SeedArgs) => {
    const ids: Id<"scheduleTemplates">[] = [];
    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("scheduleTemplates")
        .withIndex("by_class_weekday_lesson", (q: any) =>
          q
            .eq("classId", entry.classId)
            .eq("weekday", entry.weekday)
            .eq("lessonNumber", entry.lessonNumber),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          schoolId: args.schoolId,
          subject: entry.subject,
          teacherId: entry.teacherId,
          roomId: entry.roomId,
        });
        ids.push(existing._id);
      } else {
        ids.push(
          await ctx.db.insert("scheduleTemplates", {
            schoolId: args.schoolId,
            ...entry,
          }),
        );
      }
    }
    return ids;
  },
});

export const getToday = query({
  args: {
    schoolId: v.id("schools"),
    nowIso: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, args: GetTodayArgs) => {
    const school: Doc<"schools"> | null = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new Error("School not found");
    }
    const now = args.nowIso ?? new Date().toISOString();
    const weekday = new Date(now).getUTCDay();
    const schoolLocalDay = schoolDateParts(now, school.timezone);

    const templateRows: Doc<"scheduleTemplates">[] = await ctx.db
      .query("scheduleTemplates")
      .collect();
    const todayRows = templateRows.filter(
      (row) => row.schoolId === args.schoolId && row.weekday === weekday,
    );

    const overrides: Doc<"scheduleOverrides">[] = await ctx.db
      .query("scheduleOverrides")
      .withIndex("by_school_date_class_lesson", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", schoolLocalDay.date),
      )
      .collect();

    return todayRows.map((row) => {
      const override = overrides.find(
        (candidate) =>
          candidate.classId === row.classId &&
          candidate.lessonNumber === row.lessonNumber &&
          candidate.status !== "canceled",
      );
      return override
        ? {
            ...row,
            activeTeacherId: override.substituteTeacherId,
            activeRoomId: override.roomId,
            overrideId: override._id,
          }
        : {
            ...row,
            activeTeacherId: row.teacherId,
            activeRoomId: row.roomId,
            overrideId: null,
          };
    });
  },
});

export const getClassDay = query({
  args: {
    classId: v.id("classes"),
    weekday: v.number(),
  },
  handler: async (ctx: QueryCtx, args: GetClassDayArgs) => {
    return ctx.db
      .query("scheduleTemplates")
      .withIndex("by_class_weekday_lesson", (q: any) =>
        q.eq("classId", args.classId).eq("weekday", args.weekday),
      )
      .collect();
  },
});
