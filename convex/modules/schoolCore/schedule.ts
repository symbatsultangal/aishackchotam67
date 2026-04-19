import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { schoolDateParts, nowIsoString } from "../../lib/time";
import {
  scheduleCompositeSeedEntryValidator,
  scheduleSeedEntryValidator,
  scheduleOverrideStatusValidator,
} from "../../lib/validators";
import {
  buildOccupancyMaps,
  previewOverrideConflicts,
} from "../../lib/scheduleConflicts";

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

type CompositeSeedArgs = {
  schoolId: Id<"schools">;
  entries: Array<{
    classId: Id<"classes">;
    weekday: number;
    lessonNumber: number;
    rawCellText: string;
    rawRoomText?: string;
    sourceSheet?: string;
    sourceRowKey?: string;
    active: boolean;
    components: Array<{
      subject: string;
      teacherName?: string;
      teacherId?: Id<"staff">;
      roomCode?: string;
      roomId?: Id<"rooms">;
      notes?: string;
    }>;
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

function compositeEntryWrite(
  entry: CompositeSeedArgs["entries"][number],
  schoolId: Id<"schools">,
) {
  return {
    schoolId,
    classId: entry.classId,
    weekday: entry.weekday,
    lessonNumber: entry.lessonNumber,
    rawCellText: entry.rawCellText,
    active: entry.active,
    components: entry.components,
    ...(entry.rawRoomText !== undefined ? { rawRoomText: entry.rawRoomText } : {}),
    ...(entry.sourceSheet !== undefined ? { sourceSheet: entry.sourceSheet } : {}),
    ...(entry.sourceRowKey !== undefined ? { sourceRowKey: entry.sourceRowKey } : {}),
  };
}

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

export const seedCompositeEntries = mutation({
  args: {
    schoolId: v.id("schools"),
    entries: v.array(scheduleCompositeSeedEntryValidator),
  },
  handler: async (ctx: MutationCtx, args: CompositeSeedArgs) => {
    const ids: Id<"scheduleCompositeEntries">[] = [];
    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("scheduleCompositeEntries")
        .withIndex("by_class_weekday_lesson", (q: any) =>
          q
            .eq("classId", entry.classId)
            .eq("weekday", entry.weekday)
            .eq("lessonNumber", entry.lessonNumber),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, compositeEntryWrite(entry, args.schoolId));
        ids.push(existing._id);
      } else {
        ids.push(
          await ctx.db.insert("scheduleCompositeEntries", {
            ...compositeEntryWrite(entry, args.schoolId),
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

export const getTeacherLoadToday = query({
  args: {
    schoolId: v.id("schools"),
    nowIso: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, args: { schoolId: Id<"schools">; nowIso?: string }) => {
    const school: Doc<"schools"> | null = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");

    const now = args.nowIso ?? new Date().toISOString();
    const weekday = new Date(now).getUTCDay();
    const localDay = schoolDateParts(now, school.timezone);

    const templates: Doc<"scheduleTemplates">[] = await ctx.db
      .query("scheduleTemplates")
      .collect();
    const todayTemplates = templates.filter(
      (row) => row.schoolId === args.schoolId && row.weekday === weekday,
    );

    const overrides: Doc<"scheduleOverrides">[] = await ctx.db
      .query("scheduleOverrides")
      .withIndex("by_school_date_class_lesson", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", localDay.date),
      )
      .collect();

    const load: Record<string, number> = {};
    for (const row of todayTemplates) {
      const override = overrides.find(
        (o) =>
          o.classId === row.classId &&
          o.lessonNumber === row.lessonNumber &&
          o.status !== "canceled",
      );
      const activeTeacherId = override
        ? String(override.substituteTeacherId)
        : String(row.teacherId);
      load[activeTeacherId] = (load[activeTeacherId] ?? 0) + 1;
    }

    return load;
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

export const previewOverride = query({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
    lessonNumber: v.number(),
    newTeacherId: v.id("staff"),
    roomId: v.id("rooms"),
  },
  handler: async (
    ctx: QueryCtx,
    args: {
      schoolId: Id<"schools">;
      date: string;
      lessonNumber: number;
      newTeacherId: Id<"staff">;
      roomId: Id<"rooms">;
    },
  ) => {
    const weekday = new Date(`${args.date}T00:00:00Z`).getUTCDay();
    const baseRows: Doc<"scheduleTemplates">[] = await ctx.db
      .query("scheduleTemplates")
      .collect();
    const dayRows = baseRows.filter(
      (row) => row.schoolId === args.schoolId && row.weekday === weekday,
    );
    const overrides: Doc<"scheduleOverrides">[] = await ctx.db
      .query("scheduleOverrides")
      .withIndex("by_school_date_class_lesson", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", args.date),
      )
      .collect();
    const maps = buildOccupancyMaps(dayRows as any, overrides as any);
    return previewOverrideConflicts(
      maps,
      args.newTeacherId,
      args.lessonNumber,
      String(args.roomId),
    );
  },
});

export const applyManualOverride = mutation({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
    classId: v.id("classes"),
    lessonNumber: v.number(),
    originalTeacherId: v.id("staff"),
    substituteTeacherId: v.id("staff"),
    roomId: v.id("rooms"),
    subject: v.string(),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      schoolId: Id<"schools">;
      date: string;
      classId: Id<"classes">;
      lessonNumber: number;
      originalTeacherId: Id<"staff">;
      substituteTeacherId: Id<"staff">;
      roomId: Id<"rooms">;
      subject: string;
    },
  ) => {
    const requestId = await ctx.db.insert("substitutionRequests", {
      schoolId: args.schoolId,
      absentTeacherId: args.originalTeacherId,
      date: args.date,
      lessons: [args.lessonNumber],
      reason: "Manual schedule edit (drag-and-drop)",
      createdByStaffId: args.substituteTeacherId,
      status: "confirmed",
      chosenCandidates: [],
    });

    const overrideId = await ctx.db.insert("scheduleOverrides", {
      schoolId: args.schoolId,
      date: args.date,
      classId: args.classId,
      lessonNumber: args.lessonNumber,
      subject: args.subject,
      originalTeacherId: args.originalTeacherId,
      substituteTeacherId: args.substituteTeacherId,
      roomId: args.roomId,
      reason: "Manual schedule edit",
      requestId,
      status: "applied",
    });

    return overrideId;
  },
});

export const cancelOverride = mutation({
  args: {
    overrideId: v.id("scheduleOverrides"),
  },
  handler: async (ctx: MutationCtx, args: { overrideId: Id<"scheduleOverrides"> }) => {
    await ctx.db.patch(args.overrideId, { status: "canceled" });
    return args.overrideId;
  },
});
