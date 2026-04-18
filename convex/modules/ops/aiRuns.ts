import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";

import { nowIsoString } from "../../lib/time";

export const start = internalMutation({
  args: {
    schoolId: v.id("schools"),
    capability: v.string(),
    provider: v.string(),
    model: v.string(),
    sourceTable: v.string(),
    sourceId: v.string(),
    inputHash: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("aiRuns", {
      ...args,
      status: "started",
      startedAt: nowIsoString(),
    });
  },
});

export const finish = internalMutation({
  args: {
    runId: v.id("aiRuns"),
    status: v.union(v.literal("completed"), v.literal("error")),
    outputJson: v.optional(v.any()),
    outputText: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.runId);
    if (!current) {
      throw new Error("AI run not found");
    }
    const finishedAt = nowIsoString();
    await ctx.db.patch(args.runId, {
      status: args.status,
      outputJson: args.outputJson,
      outputText: args.outputText,
      error: args.error,
      finishedAt,
      latencyMs: Date.parse(finishedAt) - Date.parse(current.startedAt),
    });
    return args.runId;
  },
});

export const listStuck = internalQuery({
  args: {
    olderThanIso: v.string(),
  },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("aiRuns")
      .withIndex("by_status_startedAt", (q: any) =>
        q.eq("status", "started").lt("startedAt", args.olderThanIso),
      )
      .collect();
    return runs;
  },
});
