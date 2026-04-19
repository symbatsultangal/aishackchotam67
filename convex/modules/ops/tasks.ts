import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";

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

export const updateDetails = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueAt: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    assigneeStaffId: v.optional(v.id("staff")),
  },
  handler: async (
    ctx,
    args: {
      taskId: Id<"tasks">;
      title?: string;
      description?: string;
      dueAt?: string;
      priority?: "low" | "medium" | "high";
      assigneeStaffId?: Id<"staff">;
    },
  ) => {
    const { taskId, ...patch } = args;
    await ctx.db.patch(taskId, patch);
    return taskId;
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

function prioritySlotHour(priority: string): number {
  if (priority === "high") return 9;
  if (priority === "medium") return 13;
  return 16;
}

export const listTodayByAssignee = query({
  args: {
    schoolId: v.id("schools"),
    staffId: v.id("staff"),
    date: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args: { schoolId: Id<"schools">; staffId: Id<"staff">; date?: string },
  ) => {
    const today = args.date ?? new Date().toISOString().slice(0, 10);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_school_assignee_status_due", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("assigneeStaffId", args.staffId),
      )
      .collect();

    return tasks
      .filter((t: any) => t.status !== "done" && t.status !== "canceled")
      .map((t: any) => {
        let scheduledHour: number;
        if (t.dueAt) {
          try {
            const dueDate = new Date(t.dueAt);
            if (dueDate.toISOString().slice(0, 10) === today) {
              scheduledHour = dueDate.getUTCHours();
            } else {
              scheduledHour = prioritySlotHour(t.priority);
            }
          } catch {
            scheduledHour = prioritySlotHour(t.priority);
          }
        } else {
          scheduledHour = prioritySlotHour(t.priority);
        }
        return {
          ...t,
          scheduledHour,
        };
      })
      .sort((a: any, b: any) => a.scheduledHour - b.scheduledHour);
  },
});
