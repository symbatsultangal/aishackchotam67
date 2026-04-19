import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";
import { runJsonReasoning } from "../../lib/ai/reasoning";
import {
  buildOrderQuestioningPrompt,
  buildOrderComposePrompt,
} from "../../lib/prompts";
import { ORDER_TEMPLATES, type OrderTemplate } from "./orderTemplates";

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

const checkTargetRef = publicRef<
  "action",
  {
    schoolId: Id<"schools">;
    targetType: "task" | "schedule_override" | "freeform";
    targetId?: string;
    inputText: string;
    language?: string;
  },
  { checkId: Id<"complianceChecks">; result: string }
>("modules/rag/compliance:checkTarget");

const patchDraftRef = publicRef<
  "mutation",
  { draftId: Id<"orderDrafts">; patch: Record<string, unknown> },
  Id<"orderDrafts">
>("modules/rag/orderGenerator:_patchDraft");

const finalizeDraftRef = publicRef<
  "action",
  { draftId: Id<"orderDrafts"> },
  { draftId: Id<"orderDrafts"> }
>("modules/rag/orderGenerator:finalizeOrderDraft");

export const listTemplates = query({
  args: {},
  handler: () => {
    return ORDER_TEMPLATES.map((t) => ({
      key: t.key,
      title: t.title,
      description: t.description,
    }));
  },
});

export const getOrderDraft = query({
  args: { draftId: v.id("orderDrafts") },
  handler: async (ctx: QueryCtx, args: { draftId: Id<"orderDrafts"> }) => {
    return ctx.db.get(args.draftId);
  },
});

export const _patchDraft = mutation({
  args: {
    draftId: v.id("orderDrafts"),
    patch: v.any(),
  },
  handler: async (
    ctx: MutationCtx,
    args: { draftId: Id<"orderDrafts">; patch: Record<string, unknown> },
  ) => {
    await ctx.db.patch(args.draftId, args.patch);
    return args.draftId;
  },
});

function findTemplate(key: string): OrderTemplate {
  const tmpl = ORDER_TEMPLATES.find((t) => t.key === key);
  if (!tmpl) throw new Error(`Unknown order template key: ${key}`);
  return tmpl;
}

function formatRagContext(
  chunks: Array<{ text: string; sectionRef?: string }>,
): string {
  return chunks
    .map(
      (chunk, i) =>
        `[${chunk.sectionRef ?? `chunk-${i + 1}`}] ${chunk.text.slice(0, 500)}`,
    )
    .join("\n\n");
}

export const startOrderDraft = action({
  args: {
    schoolId: v.id("schools"),
    createdByStaffId: v.id("staff"),
    templateKey: v.string(),
    initialInstruction: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args: {
      schoolId: Id<"schools">;
      createdByStaffId: Id<"staff">;
      templateKey: string;
      initialInstruction: string;
    },
  ) => {
    const tmpl = findTemplate(args.templateKey);

    let contextText = "";
    try {
      const chunks = await ctx.runAction(retrieveContextRef, {
        schoolId: args.schoolId,
        queryText: `${tmpl.title} ${args.initialInstruction}`,
        language: "ru",
        limit: 5,
      });
      contextText = formatRagContext(chunks);
    } catch {
      contextText = "(no policy context available)";
    }

    const llm = await runJsonReasoning<{
      nextField: string | null;
      question: string | null;
      readyToDraft: boolean;
    }>({
      capability: "orderQuestioning",
      prompt: buildOrderQuestioningPrompt({
        templateTitle: tmpl.title,
        templateDescription: tmpl.description,
        requiredFields: tmpl.requiredFields,
        collectedAnswers: [],
        instruction: args.initialInstruction,
        context: contextText,
      }),
    });

    const createDraftRef = publicRef<
      "mutation",
      Record<string, unknown>,
      Id<"orderDrafts">
    >("modules/rag/orderGenerator:_createDraft");

    const draftId = await ctx.runMutation(createDraftRef, {
      schoolId: args.schoolId,
      createdByStaffId: args.createdByStaffId,
      templateKey: args.templateKey,
      instruction: args.initialInstruction,
      pendingQuestion: llm.json.question ?? undefined,
      pendingField: llm.json.nextField ?? undefined,
      status: llm.json.readyToDraft ? "drafting" : "collecting",
    });

    if (llm.json.readyToDraft) {
      await ctx.scheduler.runAfter(0, finalizeDraftRef, { draftId });
    }

    return { draftId };
  },
});

export const _createDraft = mutation({
  args: {
    schoolId: v.id("schools"),
    createdByStaffId: v.id("staff"),
    templateKey: v.string(),
    instruction: v.string(),
    pendingQuestion: v.optional(v.string()),
    pendingField: v.optional(v.string()),
    status: v.string(),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    return ctx.db.insert("orderDrafts", {
      schoolId: args.schoolId,
      createdByStaffId: args.createdByStaffId,
      templateKey: args.templateKey,
      instruction: args.instruction,
      answers: [],
      pendingQuestion: args.pendingQuestion,
      pendingField: args.pendingField,
      generatedText: undefined,
      citations: [],
      status: args.status,
    });
  },
});

export const answerOrderQuestion = action({
  args: {
    draftId: v.id("orderDrafts"),
    answerText: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args: { draftId: Id<"orderDrafts">; answerText: string },
  ) => {
    const getDraftRef = publicRef<
      "query",
      { draftId: Id<"orderDrafts"> },
      Doc<"orderDrafts"> | null
    >("modules/rag/orderGenerator:getOrderDraft");

    const draft = await ctx.runQuery(getDraftRef, { draftId: args.draftId });
    if (!draft) throw new Error("Draft not found");

    const tmpl = findTemplate(draft.templateKey);

    const newAnswers = [
      ...draft.answers,
      {
        field: draft.pendingField ?? "unknown",
        question: draft.pendingQuestion ?? "",
        answer: args.answerText,
      },
    ];

    let contextText = "";
    try {
      const chunks = await ctx.runAction(retrieveContextRef, {
        schoolId: draft.schoolId,
        queryText: `${tmpl.title} ${args.answerText}`,
        language: "ru",
        limit: 4,
      });
      contextText = formatRagContext(chunks);
    } catch {
      contextText = "(no policy context available)";
    }

    const llm = await runJsonReasoning<{
      nextField: string | null;
      question: string | null;
      readyToDraft: boolean;
    }>({
      capability: "orderQuestioning",
      prompt: buildOrderQuestioningPrompt({
        templateTitle: tmpl.title,
        templateDescription: tmpl.description,
        requiredFields: tmpl.requiredFields,
        collectedAnswers: newAnswers.map((a) => ({
          field: a.field,
          answer: a.answer,
        })),
        instruction: draft.instruction,
        context: contextText,
      }),
    });

    await ctx.runMutation(patchDraftRef, {
      draftId: args.draftId,
      patch: {
        answers: newAnswers,
        pendingField: llm.json.nextField ?? undefined,
        pendingQuestion: llm.json.question ?? undefined,
        status: llm.json.readyToDraft ? "drafting" : "collecting",
      },
    });

    if (llm.json.readyToDraft) {
      await ctx.scheduler.runAfter(0, finalizeDraftRef, {
        draftId: args.draftId,
      });
    }

    return { readyToDraft: llm.json.readyToDraft };
  },
});

export const finalizeOrderDraft = action({
  args: {
    draftId: v.id("orderDrafts"),
  },
  handler: async (
    ctx: ActionCtx,
    args: { draftId: Id<"orderDrafts"> },
  ) => {
    const getDraftRef = publicRef<
      "query",
      { draftId: Id<"orderDrafts"> },
      Doc<"orderDrafts"> | null
    >("modules/rag/orderGenerator:getOrderDraft");

    const draft = await ctx.runQuery(getDraftRef, { draftId: args.draftId });
    if (!draft) throw new Error("Draft not found");

    const tmpl = findTemplate(draft.templateKey);

    let contextText = "";
    try {
      const chunks = await ctx.runAction(retrieveContextRef, {
        schoolId: draft.schoolId,
        queryText: `${tmpl.title} ${draft.instruction}`,
        language: "ru",
        limit: 6,
      });
      contextText = formatRagContext(chunks);
    } catch {
      contextText = "(no policy context available)";
    }

    const llm = await runJsonReasoning<{
      text: string;
      citations: string[];
    }>({
      capability: "orderComposition",
      prompt: buildOrderComposePrompt({
        templateTitle: tmpl.title,
        templateDescription: tmpl.description,
        collectedAnswers: draft.answers,
        instruction: draft.instruction,
        context: contextText,
      }),
    });

    await ctx.runMutation(patchDraftRef, {
      draftId: args.draftId,
      patch: {
        generatedText: llm.json.text,
        citations: llm.json.citations ?? [],
        status: "draft",
      },
    });

    try {
      const complianceResult = await ctx.runAction(checkTargetRef, {
        schoolId: draft.schoolId,
        targetType: "freeform",
        inputText: llm.json.text,
        language: "ru",
      });
      await ctx.runMutation(patchDraftRef, {
        draftId: args.draftId,
        patch: { complianceCheckId: complianceResult.checkId },
      });
    } catch {
      // Compliance check failure is non-fatal
    }

    return { draftId: args.draftId };
  },
});
