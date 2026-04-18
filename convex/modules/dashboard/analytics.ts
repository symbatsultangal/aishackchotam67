import type { Doc, Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import { v } from "convex/values";

type SeriesArgs = {
  schoolId: Id<"schools">;
  days: number;
};

function dayKey(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export const getSeries = query({
  args: {
    schoolId: v.id("schools"),
    days: v.number(),
  },
  handler: async (ctx, args: SeriesArgs) => {
    const clampedDays = Math.max(1, Math.min(args.days, 90));
    const days = Array.from({ length: clampedDays }, (_, index) => dayKey(clampedDays - index - 1));
    const startDate = days[0] ?? dayKey(0);

    const attendance = await ctx.db
      .query("attendanceFacts")
      .withIndex("by_school_date", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    const meals = await ctx.db
      .query("mealSummaries")
      .withIndex("by_school_date", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    const incidents = await ctx.db
      .query("incidents")
      .withIndex("by_school_status_created", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_school_source_status", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    const substitutions = await ctx.db
      .query("substitutionRequests")
      .withIndex("by_school_date_status", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();

    const attendanceByDay = days.map((date) => {
      const rows = attendance.filter((row) => row.date === date);
      const present = rows.reduce((sum, row) => sum + row.presentCount, 0);
      const absent = rows.reduce((sum, row) => sum + row.absentCount, 0);
      const percent = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
      return { date, percent, present, absent };
    });

    const mealsByDay = days.map((date) => {
      const row = meals.find((item) => item.date === date);
      return {
        date,
        totalMeals: row?.totalMeals ?? 0,
        totalAbsent: row?.totalAbsent ?? 0,
      };
    });

    const incidentsByDay = days.map((date) => {
      const rows = incidents.filter((row) => row._creationTime >= Date.parse(`${date}T00:00:00Z`));
      return {
        date,
        low: rows.filter((row) => row.severity === "low").length,
        medium: rows.filter((row) => row.severity === "medium").length,
        high: rows.filter((row) => row.severity === "high").length,
      };
    });

    const taskStatus = ["todo", "in_progress", "done", "canceled"].map((status) => ({
      name: status,
      value: tasks.filter((task) => task.status === status).length,
    }));

    const substituteLoad = substitutions
      .flatMap((request) => request.chosenCandidates)
      .reduce<Array<{ staffId: Id<"staff">; count: number }>>((acc, candidate) => {
        const existing = acc.find((row) => row.staffId === candidate.staffId);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({ staffId: candidate.staffId, count: 1 });
        }
        return acc;
      }, []);

    const anomalies = [
      ...attendanceByDay
        .filter((row) => row.percent > 0 && row.percent < 85)
        .map((row) => ({
          date: row.date,
          kind: "attendance",
          description: `Посещаемость ${row.percent}% ниже нормы`,
        })),
      ...incidents
        .filter((incident: Doc<"incidents">) => incident.severity === "high" && incident._creationTime >= Date.parse(`${startDate}T00:00:00Z`))
        .map((incident) => ({
          date: new Date(incident._creationTime).toISOString().slice(0, 10),
          kind: "incident",
          description: incident.title,
        })),
    ].slice(0, 10);

    return {
      attendanceByDay,
      mealsByDay,
      incidentsByDay,
      taskStatus,
      substituteLoad,
      anomalies,
    };
  },
});
