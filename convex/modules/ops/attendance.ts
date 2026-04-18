import type { ActionCtx } from "../../_generated/server";
import { internalAction, mutation, query } from "../../_generated/server";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";

import { publicRef } from "../../lib/functionRefs";
import { hasCutoffPassed, nowIsoString, schoolDateParts } from "../../lib/time";

const listSchoolsRef = publicRef<
  "query",
  Record<string, never>,
  Array<{ _id: Id<"schools">; timezone: string }>
>("modules/schoolCore/schools:list");

const getMealSummaryRef = publicRef<
  "query",
  { schoolId: Id<"schools">; date: string },
  unknown
>("modules/ops/attendance:getMealSummary");

const listAttendanceByDateRef = publicRef<
  "query",
  { schoolId: Id<"schools">; date: string },
  Array<{ classId: Id<"classes">; mealCount: number; absentCount: number }>
>("modules/ops/attendance:listByDate");

const listActiveClassesRef = publicRef<
  "query",
  { schoolId: Id<"schools"> },
  Array<{ _id: Id<"classes">; code: string }>
>("modules/schoolCore/classes:listActive");

const saveMealSummaryRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    date: string;
    cutoffAt: string;
    totalMeals: number;
    totalAbsent: number;
    missingClasses: string[];
  },
  Id<"mealSummaries">
>("modules/ops/attendance:save");

export const upsertFact = mutation({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
    classId: v.id("classes"),
    sourceMessageId: v.id("telegramMessages"),
    presentCount: v.number(),
    absentCount: v.number(),
    mealCount: v.number(),
    confidence: v.number(),
    parserRunId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendanceFacts")
      .withIndex("by_school_date_class", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", args.date).eq("classId", args.classId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceMessageId: args.sourceMessageId,
        presentCount: args.presentCount,
        absentCount: args.absentCount,
        mealCount: args.mealCount,
        confidence: args.confidence,
        parserRunId: args.parserRunId,
      });
      return existing._id;
    }

    return ctx.db.insert("attendanceFacts", args);
  },
});

export const save = mutation({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
    cutoffAt: v.string(),
    totalMeals: v.number(),
    totalAbsent: v.number(),
    missingClasses: v.array(v.string()),
    generatedByRunId: v.optional(v.id("aiRuns")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mealSummaries")
      .withIndex("by_school_date", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", args.date),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return ctx.db.insert("mealSummaries", args);
  },
});

export const listByDate = query({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("attendanceFacts")
      .withIndex("by_school_date", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", args.date),
      )
      .collect();
  },
});

export const getMealSummary = query({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("mealSummaries")
      .withIndex("by_school_date", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", args.date),
      )
      .unique();
  },
});

export const generateDueMealSummaries = internalAction({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const schools = await ctx.runQuery(listSchoolsRef, {});
    const nowIso = nowIsoString();
    let generatedCount = 0;

    for (const school of schools) {
      if (!hasCutoffPassed(nowIso, school.timezone, 9, 0)) {
        continue;
      }

      const schoolDate = schoolDateParts(nowIso, school.timezone).date;
      const summary = await ctx.runQuery(getMealSummaryRef, {
        schoolId: school._id,
        date: schoolDate,
      });
      if (summary) {
        continue;
      }

      const facts = await ctx.runQuery(listAttendanceByDateRef, {
        schoolId: school._id,
        date: schoolDate,
      });
      const classes = await ctx.runQuery(listActiveClassesRef, {
        schoolId: school._id,
      });
      const reportedClassIds = new Set(facts.map((fact: any) => fact.classId));
      const missingClasses = classes
        .filter((classDoc: any) => !reportedClassIds.has(classDoc._id))
        .map((classDoc: any) => classDoc.code);

      await ctx.runMutation(saveMealSummaryRef, {
        schoolId: school._id,
        date: schoolDate,
        cutoffAt: nowIso,
        totalMeals: facts.reduce((sum: number, fact: any) => sum + fact.mealCount, 0),
        totalAbsent: facts.reduce((sum: number, fact: any) => sum + fact.absentCount, 0),
        missingClasses,
      });
      generatedCount += 1;
    }

    return generatedCount;
  },
});
