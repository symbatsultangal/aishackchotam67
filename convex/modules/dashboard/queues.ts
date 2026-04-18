import type { ActionCtx, QueryCtx } from "../../_generated/server";
import { internalActionGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";

const query: any = queryGeneric;
const internalAction: any = internalActionGeneric;

const listSchoolsRef = publicRef<"query", Record<string, never>, Array<{ _id: string }>>(
  "modules/schoolCore/schools:list",
);

export const listReviewQueues = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx: QueryCtx, args: { schoolId: string }) => {
    const pendingMessages = await ctx.db
      .query("telegramMessages")
      .withIndex("by_school_status_receivedAt", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("parserStatus", "pending"),
      )
      .collect();

    const pendingSubstitutions = await ctx.db
      .query("substitutionRequests")
      .withIndex("by_school_date_status", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();

    return {
      pendingMessages,
      pendingSubstitutions: pendingSubstitutions.filter(
        (request: any) => request.status === "ranked" || request.status === "pending",
      ),
    };
  },
});

export const buildDirectorDigest = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<number> => {
    const schools: Array<{ _id: string }> = await ctx.runQuery(listSchoolsRef, {});
    return schools.length;
  },
});
