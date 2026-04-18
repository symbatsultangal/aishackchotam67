import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";

import { internalRef } from "./lib/functionRefs";

const internalAction: any = internalActionGeneric;
const internalQuery: any = internalQueryGeneric;
const internalMutation: any = internalMutationGeneric;

const listStuckRunsRef = internalRef<
  "query",
  { olderThanIso: string },
  Array<{ _id: Id<"aiRuns"> }>
>("modules/ops/aiRuns:listStuck");

const finishAiRunRef = internalRef<
  "mutation",
  {
    runId: Id<"aiRuns">;
    status: "completed" | "error";
    outputJson?: any;
    outputText?: string;
    error?: string;
  },
  Id<"aiRuns">
>("modules/ops/aiRuns:finish");

const listVoiceCommandsWithAudioRef = internalRef<
  "query",
  Record<string, never>,
  Array<{ _id: Id<"voiceCommands">; audioStorageId?: Id<"_storage"> }>
>("ops:_listVoiceCommandsWithAudio");

const clearVoiceAudioRef = internalRef<
  "mutation",
  { commandId: Id<"voiceCommands"> },
  Id<"voiceCommands">
>("ops:_clearVoiceAudio");

export const retryStuckAiRuns = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<number> => {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const runs: Array<{ _id: Id<"aiRuns"> }> = await ctx.runQuery(listStuckRunsRef, {
      olderThanIso: cutoff,
    });

    for (const run of runs) {
      await ctx.runMutation(finishAiRunRef, {
        runId: run._id,
        status: "error",
        error: "Marked as stale by scheduled retry job",
      });
    }

    return runs.length;
  },
});

export const cleanupExpiredAudio = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<number> => {
    const commands = await ctx.runQuery(listVoiceCommandsWithAudioRef, {});
    let deleted = 0;
    for (const command of commands) {
      if (command.audioStorageId) {
        await ctx.storage.delete(command.audioStorageId);
        await ctx.runMutation(clearVoiceAudioRef, {
          commandId: command._id,
        });
        deleted += 1;
      }
    }
    return deleted;
  },
});

export const _listVoiceCommandsWithAudio = internalQuery({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const commands = await ctx.db.query("voiceCommands").collect();
    return commands.filter((command: any) => command.audioStorageId);
  },
});

export const _clearVoiceAudio = internalMutation({
  args: {
    commandId: v.id("voiceCommands"),
  },
  handler: async (ctx: MutationCtx, args: { commandId: Id<"voiceCommands"> }) => {
    await ctx.db.patch(args.commandId, {
      audioStorageId: undefined,
    });
    return args.commandId;
  },
});
