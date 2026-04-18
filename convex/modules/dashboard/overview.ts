import { query } from "../../_generated/server";
import { v } from "convex/values";

import { schoolDateParts } from "../../lib/time";

export const getOverview = query({
  args: {
    schoolId: v.id("schools"),
    nowIso: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new Error("School not found");
    }

    const nowIso = args.nowIso ?? new Date().toISOString();
    const schoolDate = schoolDateParts(nowIso, school.timezone).date;

    const [openIncidents, tasks, substitutions, mealSummary, notifications] =
      await Promise.all([
        ctx.db
          .query("incidents")
          .withIndex("by_school_status_created", (q: any) =>
            q.eq("schoolId", args.schoolId).eq("status", "open"),
          )
          .collect(),
        ctx.db
          .query("tasks")
          .withIndex("by_school_source_status", (q: any) => q.eq("schoolId", args.schoolId))
          .collect(),
        ctx.db
          .query("substitutionRequests")
          .withIndex("by_school_date_status", (q: any) =>
            q.eq("schoolId", args.schoolId).eq("date", schoolDate),
          )
          .collect(),
        ctx.db
          .query("mealSummaries")
          .withIndex("by_school_date", (q: any) =>
            q.eq("schoolId", args.schoolId).eq("date", schoolDate),
          )
          .unique(),
        ctx.db
          .query("notifications")
          .withIndex("by_school_status_scheduledFor", (q: any) =>
            q.eq("schoolId", args.schoolId),
          )
          .take(20),
      ]);

    return {
      schoolDate,
      openIncidentCount: openIncidents.length,
      taskCounts: {
        todo: tasks.filter((task: any) => task.status === "todo").length,
        inProgress: tasks.filter((task: any) => task.status === "in_progress").length,
        done: tasks.filter((task: any) => task.status === "done").length,
      },
      substitutionCount: substitutions.length,
      mealSummary,
      recentNotifications: notifications,
    };
  },
});
