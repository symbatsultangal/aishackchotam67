import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

export const createFromParse = mutation({
  args: {
    schoolId: v.id("schools"),
    sourceMessageId: v.id("telegramMessages"),
    reportedByStaffId: v.id("staff"),
    category: v.string(),
    title: v.string(),
    description: v.string(),
    location: v.optional(v.string()),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("incidents", {
      ...args,
      status: "open",
    });
  },
});

export const updateStatus = mutation({
  args: {
    incidentId: v.id("incidents"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.incidentId, { status: args.status });
    return args.incidentId;
  },
});

export const listOpen = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("incidents")
      .withIndex("by_school_status_created", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("status", "open"),
      )
      .collect();
  },
});
