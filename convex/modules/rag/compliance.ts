import type { Id } from "../../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";
import { buildCompliancePrompt, buildRewritePrompt } from "../../lib/prompts";
import { runJsonReasoning, runTextReasoning } from "../../lib/ai/reasoning";
import { nowIsoString } from "../../lib/time";
import {
  complianceResultValidator,
  complianceTargetTypeValidator,
} from "../../lib/validators";

const action: any = actionGeneric;
const mutation: any = mutationGeneric;
const query: any = queryGeneric;

const retrieveContextRef = publicRef<
  "action",
  {
    schoolId: Id<"schools">;
    queryText: string;
    language?: string;
    limit?: number;
  },
  Array<{ _id: Id<"ministryChunks">; text: string; sectionRef?: string }>
>("modules/rag/retrieval:retrieveContext");

const saveResultRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    targetType: "task" | "schedule_override" | "freeform";
    targetId?: string;
    inputText: string;
    result: "pass" | "warn" | "fail";
    findings: string[];
    citations: string[];
    rewriteText?: string;
  },
  Id<"complianceChecks">
>("modules/rag/compliance:saveResult");

type SaveResultArgs = {
  schoolId: Id<"schools">;
  targetType: "task" | "schedule_override" | "freeform";
  targetId?: string;
  inputText: string;
  result: "pass" | "warn" | "fail";
  findings: string[];
  citations: string[];
  rewriteText?: string;
};

type ListRecentArgs = {
  schoolId: Id<"schools">;
};

type CheckTargetArgs = {
  schoolId: Id<"schools">;
  targetType: "task" | "schedule_override" | "freeform";
  targetId?: string;
  inputText: string;
  language?: string;
};

type RewriteArgs = {
  schoolId: Id<"schools">;
  sourceText: string;
  language?: string;
};

export const saveResult = mutation({
  args: {
    schoolId: v.id("schools"),
    targetType: complianceTargetTypeValidator,
    targetId: v.optional(v.string()),
    inputText: v.string(),
    result: complianceResultValidator,
    findings: v.array(v.string()),
    citations: v.array(v.string()),
    rewriteText: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: SaveResultArgs) => {
    return ctx.db.insert("complianceChecks", {
      ...args,
      checkedAt: nowIsoString(),
    });
  },
});

export const listRecent = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx: QueryCtx, args: ListRecentArgs) => {
    return ctx.db
      .query("complianceChecks")
      .withIndex("by_school_result_checkedAt", (q: any) => q.eq("schoolId", args.schoolId))
      .take(50);
  },
});

export const checkTarget = action({
  args: {
    schoolId: v.id("schools"),
    targetType: complianceTargetTypeValidator,
    targetId: v.optional(v.string()),
    inputText: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args: CheckTargetArgs) => {
    const contextChunks = await ctx.runAction(retrieveContextRef, {
      schoolId: args.schoolId,
      queryText: args.inputText,
      language: args.language,
      limit: 6,
    });

    const context = contextChunks
      .map((chunk: any) => `[${chunk.sectionRef ?? chunk._id}] ${chunk.text}`)
      .join("\n\n");

    const reasoning = await runJsonReasoning<{
      result: "pass" | "warn" | "fail";
      findings: string[];
      citations: string[];
      rewriteText?: string;
    }>({
      capability: "complianceReasoning",
      prompt: buildCompliancePrompt(args.inputText, context),
    });

    const checkId = await ctx.runMutation(saveResultRef, {
      schoolId: args.schoolId,
      targetType: args.targetType,
      targetId: args.targetId,
      inputText: args.inputText,
      result: reasoning.json.result,
      findings: reasoning.json.findings,
      citations: reasoning.json.citations,
      rewriteText: reasoning.json.rewriteText,
    });

    return {
      checkId,
      ...reasoning.json,
    };
  },
});

export const rewritePlainLanguage = action({
  args: {
    schoolId: v.id("schools"),
    sourceText: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args: RewriteArgs) => {
    const contextChunks = await ctx.runAction(retrieveContextRef, {
      schoolId: args.schoolId,
      queryText: args.sourceText,
      language: args.language,
      limit: 4,
    });
    const context = contextChunks.map((chunk: any) => chunk.text).join("\n\n");
    const rewrite = await runTextReasoning({
      capability: "complianceReasoning",
      prompt: buildRewritePrompt(args.sourceText, context),
    });

    return {
      text: rewrite.text,
    };
  },
});
