import { action, mutation, query, type ActionCtx } from "../../_generated/server";
import { v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";

import { publicRef } from "../../lib/functionRefs";
import { buildDirectorRoutingPrompt } from "../../lib/prompts";
import { nowIsoString } from "../../lib/time";
import { runJsonReasoning } from "../../lib/ai/reasoning";
import { transcribeAudioBlob } from "../../lib/ai/transcription";
import { matchStaffByName } from "../../lib/nameMatching";
import { parseDueText } from "../../lib/dueDate";

type TaskPlan = {
  title: string;
  description: string;
  assigneeName: string;
  assigneeStaffId: Id<"staff"> | null;
  matchConfidence: "exact" | "fuzzy" | "none";
  candidateStaffIds: Id<"staff">[];
  dueAt: string | null;
  dueText: string;
  priority: "low" | "medium" | "high";
};

type SubstitutionPlan = {
  absentTeacherName: string;
  absentTeacherStaffId: Id<"staff"> | null;
  date: string;
  lessons: number[];
  reason: string;
};

type PlanPayload = {
  intent: "task_batch" | "substitution" | "order_draft" | "unclear";
  tasks: TaskPlan[];
  substitution: SubstitutionPlan | null;
  orderDraft: { templateKey: string; instruction: string } | null;
};

const getCommandByIdRef = publicRef<
  "query",
  { commandId: Id<"voiceCommands"> },
  Doc<"voiceCommands"> | null
>("modules/ops/voice:_getCommandById");

const getSchoolForCommandRef = publicRef<
  "query",
  { commandId: Id<"voiceCommands"> },
  { _id: Id<"schools">; timezone: string } | null
>("modules/ops/voice:_getSchoolForCommand");

const patchCommandRef = publicRef<
  "mutation",
  {
    commandId: Id<"voiceCommands">;
    patch: {
      transcript?: string;
      normalizedCommand?: string;
      status:
        | "uploaded"
        | "transcribed"
        | "planned"
        | "routed"
        | "error";
      intent?: "task_batch" | "substitution" | "order_draft" | "unclear";
      substitutionDraft?: {
        absentTeacherName: string;
        date: string;
        lessons: number[];
        reason: string;
      };
      substitutionRequestId?: Id<"substitutionRequests">;
    };
  },
  Id<"voiceCommands">
>("modules/ops/voice:_patchCommand");

const planDirectorCommandRef = publicRef<
  "action",
  { commandId: Id<"voiceCommands"> },
  { intent: string }
>("modules/ops/voice:planDirectorCommand");

const transcribeAudioRef = publicRef<
  "action",
  { commandId: Id<"voiceCommands"> },
  { transcript: string }
>("modules/ops/voice:transcribeAudio");

const listAssignableStaffRef = publicRef<
  "query",
  { schoolId: Id<"schools">; activeOnly?: boolean },
  Array<{
    _id: Id<"staff">;
    displayName: string;
    fullName: string;
  }>
>("modules/schoolCore/staff:listAssignable");

const createTasksRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    tasks: Array<{
      source: "voice";
      title: string;
      description: string;
      assigneeStaffId: Id<"staff">;
      creatorStaffId: Id<"staff">;
      dueAt?: string;
      priority: "low" | "medium" | "high";
      relatedCommandId: Id<"voiceCommands">;
    }>;
  },
  Id<"tasks">[]
>("modules/ops/tasks:createBatch");

const enqueueNotificationRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    recipientStaffId: Id<"staff">;
    templateKey: string;
    payload: any;
    scheduledFor: string;
    dedupeKey: string;
  },
  Id<"notifications">
>("modules/ops/notifications:enqueue");

const createSubstitutionRequestRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    absentTeacherId: Id<"staff">;
    date: string;
    lessons: number[];
    reason: string;
    createdByStaffId: Id<"staff">;
    sourceCommandId?: Id<"voiceCommands">;
  },
  Id<"substitutionRequests">
>("modules/substitutions/requests:createFromVoice");

const rankCandidatesRef = publicRef<
  "action",
  { requestId: Id<"substitutionRequests"> },
  unknown
>("modules/substitutions/planner:rankCandidates");

export const createDashboardUpload = mutation({
  args: {},
  handler: async (ctx) => {
    return ctx.storage.generateUploadUrl();
  },
});

export const submitDashboardAudio = mutation({
  args: {
    schoolId: v.id("schools"),
    createdByStaffId: v.id("staff"),
    audioStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const commandId = await ctx.db.insert("voiceCommands", {
      schoolId: args.schoolId,
      createdByStaffId: args.createdByStaffId,
      source: "dashboard",
      audioStorageId: args.audioStorageId,
      status: "uploaded",
    });

    await ctx.scheduler.runAfter(0, transcribeAudioRef, {
      commandId,
    });

    return commandId;
  },
});

// Optional: accept a typed transcript when browser recording isn't available.
// Callers can POST text directly and skip Whisper.
export const submitDashboardTranscript = mutation({
  args: {
    schoolId: v.id("schools"),
    createdByStaffId: v.id("staff"),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const commandId = await ctx.db.insert("voiceCommands", {
      schoolId: args.schoolId,
      createdByStaffId: args.createdByStaffId,
      source: "dashboard",
      transcript: args.transcript,
      status: "transcribed",
    });
    await ctx.scheduler.runAfter(0, planDirectorCommandRef, { commandId });
    return commandId;
  },
});

export const getCommandStatus = query({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.commandId);
    if (!command) {
      return null;
    }

    let plan: PlanPayload | null = null;
    if (command.normalizedCommand) {
      try {
        plan = JSON.parse(command.normalizedCommand) as PlanPayload;
      } catch {
        plan = null;
      }
    }

    // Hydrate staff picker data: fetch every candidate referenced by the plan
    // so the UI can render names/picker options without a round-trip per row.
    const referencedStaffIds = new Set<string>();
    if (plan) {
      for (const task of plan.tasks ?? []) {
        if (task.assigneeStaffId) referencedStaffIds.add(String(task.assigneeStaffId));
        for (const id of task.candidateStaffIds ?? []) {
          referencedStaffIds.add(String(id));
        }
      }
      if (plan.substitution?.absentTeacherStaffId) {
        referencedStaffIds.add(String(plan.substitution.absentTeacherStaffId));
      }
    }
    const staffRows = await Promise.all(
      Array.from(referencedStaffIds).map((id) =>
        ctx.db.get(id as Id<"staff">),
      ),
    );
    const staffDirectory = staffRows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map((row) => ({
        _id: row._id,
        displayName: row.displayName,
        fullName: row.fullName,
      }));

    return {
      _id: command._id,
      status: command.status,
      transcript: command.transcript,
      intent: command.intent ?? plan?.intent ?? null,
      plan,
      staffDirectory,
      substitutionRequestId: command.substitutionRequestId ?? null,
    };
  },
});

export const transcribeAudio = action({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (ctx: ActionCtx, args: { commandId: Id<"voiceCommands"> }) => {
    const command = await ctx.runQuery(getCommandByIdRef, {
      commandId: args.commandId,
    });
    if (!command?.audioStorageId) {
      throw new Error("Voice command has no audio payload");
    }

    const audioBlob = await ctx.storage.get(command.audioStorageId);
    if (!audioBlob) {
      throw new Error("Audio file not found");
    }

    const school = await ctx.runQuery(getSchoolForCommandRef, {
      commandId: args.commandId,
    });
    const language = (school?.timezone ?? "").startsWith("Asia/") ? "ru" : "ru";
    const transcription = await transcribeAudioBlob(audioBlob, process.env, {
      language,
    });
    await ctx.runMutation(patchCommandRef, {
      commandId: args.commandId,
      patch: {
        transcript: transcription.transcript,
        status: "transcribed",
      },
    });

    await ctx.scheduler.runAfter(0, planDirectorCommandRef, {
      commandId: args.commandId,
    });

    return transcription;
  },
});

/**
 * P0-2 + P1-4: plan step. Turn the transcript into a structured plan with
 * intent classification, fuzzy-matched assignees, parsed ISO due dates,
 * and candidate picker suggestions — WITHOUT creating tasks. The director
 * reviews and edits in the UI, then calls confirmDirectorCommand.
 */
export const planDirectorCommand = action({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (
    ctx: ActionCtx,
    args: { commandId: Id<"voiceCommands"> },
  ): Promise<{ intent: string }> => {
    const command = await ctx.runQuery(getCommandByIdRef, {
      commandId: args.commandId,
    });
    if (!command?.transcript) {
      throw new Error("Voice command has not been transcribed");
    }

    const school = await ctx.runQuery(getSchoolForCommandRef, {
      commandId: args.commandId,
    });
    if (!school) {
      throw new Error("School not found for command");
    }

    const assignable = await ctx.runQuery(listAssignableStaffRef, {
      schoolId: command.schoolId,
      activeOnly: true,
    });
    const staffPool = assignable.map((staff) => ({
      _id: String(staff._id),
      displayName: staff.displayName,
      fullName: staff.fullName,
    }));

    const todayIso = nowIsoString();
    let llmResult;
    try {
      llmResult = await runJsonReasoning<{
        intent?: "task_batch" | "substitution" | "order_draft" | "unclear";
        tasks?: Array<{
          title?: string;
          description?: string;
          assigneeName?: string;
          dueAtIso?: string | null;
          dueText?: string;
          priority?: "low" | "medium" | "high";
        }>;
        substitution?: {
          absentTeacherName?: string;
          date?: string;
          lessons?: number[];
          reason?: string;
        };
        orderDraft?: {
          templateKey?: string;
          instruction?: string;
        };
      }>({
        capability: "directorCommandRouting",
        prompt: buildDirectorRoutingPrompt(command.transcript, {
          todayIso,
          timezone: school.timezone,
          staffNames: assignable.map((staff) => staff.fullName),
        }),
      });
    } catch (error) {
      await ctx.runMutation(patchCommandRef, {
        commandId: command._id,
        patch: { status: "error" },
      });
      throw error;
    }

    const intent = llmResult.json.intent ?? "unclear";

    // Resolve each task's assignee with the fuzzy matcher and parse dueText.
    const tasks: TaskPlan[] = (llmResult.json.tasks ?? []).map((rawTask) => {
      const query = rawTask.assigneeName ?? "";
      const matchResult = matchStaffByName(query, staffPool);
      const dueText = rawTask.dueText ?? "";
      const dueAtIsoFromLlm = rawTask.dueAtIso
        ? (isValidIso(rawTask.dueAtIso) ? rawTask.dueAtIso : null)
        : null;
      const dueAt =
        dueAtIsoFromLlm ?? parseDueText(dueText, todayIso, school.timezone);

      return {
        title: rawTask.title ?? "Задача",
        description: rawTask.description ?? "",
        assigneeName: query,
        assigneeStaffId:
          matchResult.staff !== null
            ? (matchResult.staff._id as Id<"staff">)
            : null,
        matchConfidence: matchResult.confidence,
        candidateStaffIds: matchResult.candidates.map(
          (candidate) => candidate._id as Id<"staff">,
        ),
        dueAt,
        dueText,
        priority: rawTask.priority ?? "medium",
      };
    });

    // For substitution intent, match the absent teacher name.
    let substitution: SubstitutionPlan | null = null;
    if (intent === "substitution" && llmResult.json.substitution) {
      const teacherName = llmResult.json.substitution.absentTeacherName ?? "";
      const match = matchStaffByName(teacherName, staffPool);
      substitution = {
        absentTeacherName: teacherName,
        absentTeacherStaffId:
          match.staff !== null
            ? (match.staff._id as Id<"staff">)
            : null,
        date:
          llmResult.json.substitution.date && isValidIsoDate(llmResult.json.substitution.date)
            ? llmResult.json.substitution.date
            : defaultSubstitutionDate(todayIso, school.timezone),
        lessons: Array.isArray(llmResult.json.substitution.lessons)
          ? llmResult.json.substitution.lessons.filter((n) => Number.isFinite(n))
          : [],
        reason: llmResult.json.substitution.reason ?? "Voice command",
      };
    }

    const orderDraft =
      intent === "order_draft" && llmResult.json.orderDraft
        ? {
            templateKey: llmResult.json.orderDraft.templateKey ?? "",
            instruction: llmResult.json.orderDraft.instruction ?? command.transcript,
          }
        : null;

    const plan: PlanPayload = {
      intent,
      tasks,
      substitution,
      orderDraft,
    };

    await ctx.runMutation(patchCommandRef, {
      commandId: command._id,
      patch: {
        normalizedCommand: JSON.stringify(plan),
        status: "planned",
        intent,
        substitutionDraft:
          substitution !== null
            ? {
                absentTeacherName: substitution.absentTeacherName,
                date: substitution.date,
                lessons: substitution.lessons,
                reason: substitution.reason,
              }
            : undefined,
      },
    });

    return { intent };
  },
});

/**
 * P0-2: confirm step — creates the tasks (or substitution request) using the
 * director-edited plan. Plan edits come in as an optional override; otherwise
 * we use whatever is stored on the command from the LLM.
 */
export const confirmDirectorCommand = action({
  args: {
    commandId: v.id("voiceCommands"),
    editedPlan: v.optional(
      v.object({
        tasks: v.array(
          v.object({
            title: v.string(),
            description: v.string(),
            assigneeStaffId: v.id("staff"),
            dueAt: v.optional(v.string()),
            priority: v.union(
              v.literal("low"),
              v.literal("medium"),
              v.literal("high"),
            ),
          }),
        ),
      }),
    ),
  },
  handler: async (
    ctx: ActionCtx,
    args: {
      commandId: Id<"voiceCommands">;
      editedPlan?: {
        tasks: Array<{
          title: string;
          description: string;
          assigneeStaffId: Id<"staff">;
          dueAt?: string;
          priority: "low" | "medium" | "high";
        }>;
      };
    },
  ): Promise<{ taskCount: number; tasks: Id<"tasks">[]; substitutionRequestId?: Id<"substitutionRequests"> }> => {
    const command = await ctx.runQuery(getCommandByIdRef, {
      commandId: args.commandId,
    });
    if (!command?.normalizedCommand) {
      throw new Error("Command has no plan to confirm");
    }

    const plan = JSON.parse(command.normalizedCommand) as PlanPayload;

    // Substitution intent: create the substitution request + rank candidates.
    if (plan.intent === "substitution" && plan.substitution?.absentTeacherStaffId) {
      const requestId = await ctx.runMutation(createSubstitutionRequestRef, {
        schoolId: command.schoolId,
        absentTeacherId: plan.substitution.absentTeacherStaffId,
        date: plan.substitution.date,
        lessons: plan.substitution.lessons.length > 0 ? plan.substitution.lessons : [1],
        reason: plan.substitution.reason,
        createdByStaffId: command.createdByStaffId,
        sourceCommandId: command._id,
      });

      await ctx.scheduler.runAfter(0, rankCandidatesRef, { requestId });

      await ctx.runMutation(patchCommandRef, {
        commandId: command._id,
        patch: {
          status: "routed",
          substitutionRequestId: requestId,
        },
      });

      return { taskCount: 0, tasks: [], substitutionRequestId: requestId };
    }

    // Task batch intent: build payloads and create.
    const taskPayloads = args.editedPlan
      ? args.editedPlan.tasks.map((task) => ({
          source: "voice" as const,
          title: task.title,
          description: task.description,
          assigneeStaffId: task.assigneeStaffId,
          creatorStaffId: command.createdByStaffId,
          dueAt: task.dueAt,
          priority: task.priority,
          relatedCommandId: command._id,
        }))
      : plan.tasks
          .filter((task) => task.assigneeStaffId !== null)
          .map((task) => ({
            source: "voice" as const,
            title: task.title,
            description: task.description,
            assigneeStaffId: task.assigneeStaffId as Id<"staff">,
            creatorStaffId: command.createdByStaffId,
            dueAt: task.dueAt ?? undefined,
            priority: task.priority,
            relatedCommandId: command._id,
          }));

    const taskIds: Id<"tasks">[] =
      taskPayloads.length > 0
        ? await ctx.runMutation(createTasksRef, {
            schoolId: command.schoolId,
            tasks: taskPayloads,
          })
        : [];

    for (let index = 0; index < taskPayloads.length; index += 1) {
      const task = taskPayloads[index];
      const taskId = taskIds[index];
      if (!task || !taskId) continue;
      await ctx.runMutation(enqueueNotificationRef, {
        schoolId: command.schoolId,
        recipientStaffId: task.assigneeStaffId,
        templateKey: "voice_task_created",
        payload: {
          text: `Новая задача: ${task.title}\n${task.description}`,
        },
        scheduledFor: nowIsoString(),
        dedupeKey: `voice:${command._id}:task:${taskId}`,
      });
    }

    await ctx.runMutation(patchCommandRef, {
      commandId: command._id,
      patch: { status: "routed" },
    });

    return { taskCount: taskIds.length, tasks: taskIds };
  },
});

/**
 * Legacy entry point — some callers may still invoke routeDirectorCommand.
 * Thin shim: plan then immediately confirm (preserves old behavior).
 */
export const routeDirectorCommand = action({
  args: { commandId: v.id("voiceCommands") },
  handler: async (
    ctx: ActionCtx,
    args: { commandId: Id<"voiceCommands"> },
  ): Promise<{ taskCount: number; tasks: Id<"tasks">[] }> => {
    await ctx.runAction(planDirectorCommandRef, { commandId: args.commandId });
    const confirmAction = publicRef<
      "action",
      { commandId: Id<"voiceCommands"> },
      { taskCount: number; tasks: Id<"tasks">[] }
    >("modules/ops/voice:confirmDirectorCommand");
    return ctx.runAction(confirmAction, { commandId: args.commandId });
  },
});

export const _getCommandById = query({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.commandId);
  },
});

export const _getSchoolForCommand = query({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.commandId);
    if (!command) return null;
    return ctx.db.get(command.schoolId);
  },
});

export const _patchCommand = mutation({
  args: {
    commandId: v.id("voiceCommands"),
    patch: v.object({
      transcript: v.optional(v.string()),
      normalizedCommand: v.optional(v.string()),
      status: v.union(
        v.literal("uploaded"),
        v.literal("transcribed"),
        v.literal("planned"),
        v.literal("routed"),
        v.literal("error"),
      ),
      intent: v.optional(
        v.union(
          v.literal("task_batch"),
          v.literal("substitution"),
          v.literal("order_draft"),
          v.literal("unclear"),
        ),
      ),
      substitutionDraft: v.optional(
        v.object({
          absentTeacherName: v.string(),
          date: v.string(),
          lessons: v.array(v.number()),
          reason: v.string(),
        }),
      ),
      substitutionRequestId: v.optional(v.id("substitutionRequests")),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commandId, args.patch);
    return args.commandId;
  },
});

function isValidIso(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function defaultSubstitutionDate(referenceIso: string, _timeZone: string): string {
  // Default to "tomorrow" in UTC terms; the planner re-interprets in tz.
  const tomorrow = new Date(referenceIso);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}
