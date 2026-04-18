import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

export const createBatch = mutation({
  args: {
    schoolId: v.id("schools"),
    tasks: v.array(
      v.object({
        source: v.union(
          v.literal("incident"),
          v.literal("voice"),
          v.literal("manual"),
          v.literal("compliance"),
        ),
        title: v.string(),
        description: v.string(),
        assigneeStaffId: v.id("staff"),
        creatorStaffId: v.id("staff"),
        dueAt: v.optional(v.string()),
        priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        relatedIncidentId: v.optional(v.id("incidents")),
        relatedCommandId: v.optional(v.id("voiceCommands")),
        complianceCheckId: v.optional(v.id("complianceChecks")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const ids: any[] = [];
    for (const task of args.tasks) {
      ids.push(
        await ctx.db.insert("tasks", {
          schoolId: args.schoolId,
          ...task,
          status: "todo",
        }),
      );
    }
    return ids;
  },
});

export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("canceled"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { status: args.status });
    return args.taskId;
  },
});

export const listBoard = query({
  args: {
    schoolId: v.id("schools"),
    assigneeStaffId: v.optional(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_school_source_status", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    if (!args.assigneeStaffId) {
      return tasks;
    }
    return tasks.filter((task: any) => task.assigneeStaffId === args.assigneeStaffId);
  },
});
