import { action, mutation, query, type ActionCtx } from "../../_generated/server";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";

import { publicRef } from "../../lib/functionRefs";
import { buildDirectorRoutingPrompt } from "../../lib/prompts";
import { nowIsoString } from "../../lib/time";
import { runJsonReasoning } from "../../lib/ai/reasoning";
import { transcribeAudioBlob } from "../../lib/ai/transcription";

const getCommandByIdRef = publicRef<
  "query",
  { commandId: Id<"voiceCommands"> },
  {
    _id: Id<"voiceCommands">;
    schoolId: Id<"schools">;
    createdByStaffId: Id<"staff">;
    audioStorageId?: Id<"_storage">;
    transcript?: string;
  } | null
>("modules/ops/voice:_getCommandById");

const patchCommandRef = publicRef<
  "mutation",
  {
    commandId: Id<"voiceCommands">;
    patch: {
      transcript?: string;
      normalizedCommand?: string;
      status: "uploaded" | "transcribed" | "routed" | "error";
    };
  },
  Id<"voiceCommands">
>("modules/ops/voice:_patchCommand");

const routeDirectorCommandRef = publicRef<
  "action",
  { commandId: Id<"voiceCommands"> },
  unknown
>("modules/ops/voice:routeDirectorCommand");

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

export const getCommandStatus = query({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.commandId);
    if (!command) {
      return null;
    }

    let tasks: Array<{
      title: string;
      description: string;
      assigneeName: string;
      dueText?: string;
      priority?: "low" | "medium" | "high";
    }> = [];

    if (command.normalizedCommand) {
      const parsed = JSON.parse(command.normalizedCommand) as {
        tasks?: Array<{
          title: string;
          description: string;
          assigneeName: string;
          dueText?: string;
          priority?: "low" | "medium" | "high";
        }>;
      };
      tasks = parsed.tasks ?? [];
    }

    return {
      _id: command._id,
      status: command.status,
      transcript: command.transcript,
      normalizedCommand: command.normalizedCommand,
      tasks,
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

    const transcription = await transcribeAudioBlob(audioBlob);
    await ctx.runMutation(patchCommandRef, {
      commandId: args.commandId,
      patch: {
        transcript: transcription.transcript,
        status: "transcribed",
      },
    });

    await ctx.scheduler.runAfter(0, routeDirectorCommandRef, {
      commandId: args.commandId,
    });

    return transcription;
  },
});

export const routeDirectorCommand = action({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (
    ctx: ActionCtx,
    args: { commandId: Id<"voiceCommands"> },
  ): Promise<{ taskCount: number; tasks: Id<"tasks">[] }> => {
    const command = await ctx.runQuery(getCommandByIdRef, {
      commandId: args.commandId,
    });
    if (!command?.transcript) {
      throw new Error("Voice command has not been transcribed");
    }

    const result: {
      provider: string;
      model: string;
      json: {
        tasks: Array<{
          title: string;
          description: string;
          assigneeName: string;
          dueText?: string;
          priority?: "low" | "medium" | "high";
        }>;
      };
      rawText: string;
    } = await runJsonReasoning<{
      tasks: Array<{
        title: string;
        description: string;
        assigneeName: string;
        dueText?: string;
        priority?: "low" | "medium" | "high";
      }>;
    }>({
      capability: "directorCommandRouting",
      prompt: buildDirectorRoutingPrompt(command.transcript),
    });

    const assignable = await ctx.runQuery(listAssignableStaffRef, {
      schoolId: command.schoolId,
      activeOnly: true,
    });

    const taskPayloads = result.json.tasks
      .map((task: {
        title: string;
        description: string;
        assigneeName: string;
        dueText?: string;
        priority?: "low" | "medium" | "high";
      }) => {
        const assignee = assignable.find(
          (staff: any) =>
            staff.displayName.toLowerCase() === task.assigneeName.toLowerCase() ||
            staff.fullName.toLowerCase() === task.assigneeName.toLowerCase(),
        );
        if (!assignee) {
          return null;
        }
        return {
          source: "voice" as const,
          title: task.title,
          description: task.description,
          assigneeStaffId: assignee._id,
          creatorStaffId: command.createdByStaffId,
          dueAt: task.dueText,
          priority: task.priority ?? "medium",
          relatedCommandId: command._id,
        };
      })
      .filter((task) => task !== null);

    const typedTaskPayloads: Array<{
      source: "voice";
      title: string;
      description: string;
      assigneeStaffId: Id<"staff">;
      creatorStaffId: Id<"staff">;
      dueAt?: string;
      priority: "low" | "medium" | "high";
      relatedCommandId: Id<"voiceCommands">;
    }> = taskPayloads;

    const taskIds: Id<"tasks">[] =
      typedTaskPayloads.length > 0
        ? await ctx.runMutation(createTasksRef, {
            schoolId: command.schoolId,
            tasks: typedTaskPayloads,
          })
        : [];

    for (let index = 0; index < typedTaskPayloads.length; index += 1) {
      const task = typedTaskPayloads[index];
      const taskId = taskIds[index];
      if (!task || !taskId) {
        continue;
      }
      await ctx.runMutation(enqueueNotificationRef, {
        schoolId: command.schoolId,
        recipientStaffId: task.assigneeStaffId,
        templateKey: "voice_task_created",
        payload: {
          text: `New task: ${task.title}\n${task.description}`,
        },
        scheduledFor: nowIsoString(),
        dedupeKey: `voice:${command._id}:task:${taskId}`,
      });
    }

    await ctx.runMutation(patchCommandRef, {
      commandId: command._id,
      patch: {
        normalizedCommand: JSON.stringify(result.json),
        status: "routed",
      },
    });

    return {
      taskCount: taskIds.length,
      tasks: taskIds,
    };
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

export const _patchCommand = mutation({
  args: {
    commandId: v.id("voiceCommands"),
    patch: v.object({
      transcript: v.optional(v.string()),
      normalizedCommand: v.optional(v.string()),
      status: v.union(
        v.literal("uploaded"),
        v.literal("transcribed"),
        v.literal("routed"),
        v.literal("error"),
      ),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commandId, args.patch);
    return args.commandId;
  },
});
