import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";
import { nowIsoString } from "../../lib/time";
const mutation: any = mutationGeneric;
const query: any = queryGeneric;

const rankCandidatesRef = publicRef<
  "action",
  { requestId: Id<"substitutionRequests"> },
  unknown
>("modules/substitutions/planner:rankCandidates");

const applyOverrideRef = publicRef<
  "mutation",
  { requestId: Id<"substitutionRequests">; candidateStaffId: Id<"staff"> },
  Id<"scheduleOverrides">[]
>("modules/substitutions/overrides:applyOverride");

type CreateRequestArgs = {
  schoolId: Id<"schools">;
  absentTeacherId: Id<"staff">;
  date: string;
  lessons: number[];
  reason: string;
  createdByStaffId: Id<"staff">;
  sourceCommandId?: Id<"voiceCommands">;
};

type ListTodayArgs = {
  schoolId: Id<"schools">;
  date?: string;
};

type GetRequestArgs = {
  requestId: Id<"substitutionRequests">;
};

type ConfirmOverrideArgs = {
  requestId: Id<"substitutionRequests">;
  candidateStaffId: Id<"staff">;
};

export const createRequest = mutation({
  args: {
    schoolId: v.id("schools"),
    absentTeacherId: v.id("staff"),
    date: v.string(),
    lessons: v.array(v.number()),
    reason: v.string(),
    createdByStaffId: v.id("staff"),
    sourceCommandId: v.optional(v.id("voiceCommands")),
  },
  handler: async (ctx: MutationCtx, args: CreateRequestArgs) => {
    const requestId = await ctx.db.insert("substitutionRequests", {
      ...args,
      status: "pending",
      chosenCandidates: [],
    });

    await ctx.scheduler.runAfter(0, rankCandidatesRef, {
      requestId,
    });

    return requestId;
  },
});

// P1-4: alias invoked from the voice pipeline. Identical behavior to
// createRequest — separate export gives call sites clearer semantics.
export const createFromVoice = mutation({
  args: {
    schoolId: v.id("schools"),
    absentTeacherId: v.id("staff"),
    date: v.string(),
    lessons: v.array(v.number()),
    reason: v.string(),
    createdByStaffId: v.id("staff"),
    sourceCommandId: v.optional(v.id("voiceCommands")),
  },
  handler: async (ctx: MutationCtx, args: CreateRequestArgs) => {
    const requestId = await ctx.db.insert("substitutionRequests", {
      ...args,
      status: "pending",
      chosenCandidates: [],
    });
    await ctx.scheduler.runAfter(0, rankCandidatesRef, { requestId });
    return requestId;
  },
});

export const listToday = query({
  args: {
    schoolId: v.id("schools"),
    date: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, args: ListTodayArgs) => {
    const today = args.date ?? nowIsoString().slice(0, 10);
    return ctx.db
      .query("substitutionRequests")
      .withIndex("by_school_date_status", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("date", today),
      )
      .collect();
  },
});

export const getRequest = query({
  args: {
    requestId: v.id("substitutionRequests"),
  },
  handler: async (ctx: QueryCtx, args: GetRequestArgs) => {
    return ctx.db.get(args.requestId);
  },
});

export const confirmOverride = mutation({
  args: {
    requestId: v.id("substitutionRequests"),
    candidateStaffId: v.id("staff"),
  },
  handler: async (ctx: MutationCtx, args: ConfirmOverrideArgs) => {
    await ctx.db.patch(args.requestId, {
      status: "confirmed",
    });
    await ctx.scheduler.runAfter(
      0,
      applyOverrideRef,
      {
        requestId: args.requestId,
        candidateStaffId: args.candidateStaffId,
      },
    );
    return args.requestId;
  },
});
