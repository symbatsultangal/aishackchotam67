import { action, mutation, query, type ActionCtx } from "../../_generated/server";
import { v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";

import { publicRef } from "../../lib/functionRefs";
import { runTeacherMessageExtraction } from "../../lib/ai/extraction";
import {
  buildTelegramDedupeKey,
  selectIncidentAssignee,
} from "../../lib/telegramMvp";
import { schoolDateParts } from "../../lib/time";
import { normalizeTeacherExtraction } from "../../lib/validators";

const getMessageByIdRef = publicRef<
  "query",
  { messageId: Id<"telegramMessages"> },
  Doc<"telegramMessages"> | null
>("modules/ops/telegram:_getMessageById");

const getSchoolForMessageRef = publicRef<
  "query",
  { messageId: Id<"telegramMessages"> },
  Pick<Doc<"schools">, "_id" | "timezone"> | null
>("modules/ops/telegram:_getSchoolForMessage");

const findClassByCodeRef = publicRef<
  "query",
  { schoolId: Id<"schools">; code: string },
  Pick<Doc<"classes">, "_id"> | null
>("modules/ops/telegram:_findClassByCode");

const listIncidentAssigneeCandidatesRef = publicRef<
  "query",
  { schoolId: Id<"schools"> },
  Array<Pick<Doc<"staff">, "_id" | "fullName" | "roles" | "isActive">>
>("modules/ops/telegram:_listIncidentAssigneeCandidates");

const upsertAttendanceFactRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    date: string;
    classId: Id<"classes">;
    sourceMessageId: Id<"telegramMessages">;
    presentCount: number;
    absentCount: number;
    mealCount: number;
    confidence: number;
  },
  Id<"attendanceFacts">
>("modules/ops/attendance:upsertFact");

const createIncidentRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    sourceMessageId: Id<"telegramMessages">;
    reportedByStaffId: Id<"staff">;
    category: string;
    title: string;
    description: string;
    location?: string;
    severity: "low" | "medium" | "high";
  },
  Id<"incidents">
>("modules/ops/incidents:createFromParse");

const createTaskBatchRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    tasks: Array<{
      source: "incident";
      title: string;
      description: string;
      assigneeStaffId: Id<"staff">;
      creatorStaffId: Id<"staff">;
      priority: "low" | "medium" | "high";
      relatedIncidentId: Id<"incidents">;
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
    payload: unknown;
    scheduledFor: string;
    dedupeKey: string;
  },
  Id<"notifications">
>("modules/ops/notifications:enqueue");

const setIncidentAssignmentStateRef = publicRef<
  "mutation",
  {
    incidentId: Id<"incidents">;
    assignmentStatus: "assigned" | "unassigned";
    assignmentReason: string;
    linkedTaskId?: Id<"tasks">;
  },
  Id<"incidents">
>("modules/ops/telegram:_setIncidentAssignmentState");

const updateParserStatusRef = publicRef<
  "mutation",
  {
    messageId: Id<"telegramMessages">;
    parserStatus: "pending" | "processed" | "ignored" | "error";
    parserDetails?: string;
  },
  Id<"telegramMessages">
>("modules/ops/telegram:_updateParserStatus");

const sendTelegramRef = publicRef<
  "action",
  { notificationId: Id<"notifications"> },
  unknown
>("modules/ops/notifications:sendTelegram");

export const storeInbound = mutation({
  args: {
    schoolId: v.id("schools"),
    chatId: v.string(),
    telegramMessageId: v.string(),
    updateId: v.optional(v.number()),
    telegramUserId: v.string(),
    rawText: v.optional(v.string()),
    fileId: v.optional(v.string()),
    messageType: v.union(v.literal("text"), v.literal("voice")),
    source: v.optional(v.union(v.literal("polling"), v.literal("webhook"))),
    receivedAt: v.string(),
    dedupeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegramMessages")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", args.dedupeKey))
      .unique();

    if (existing) {
      return {
        accepted: true,
        deduped: true,
        reason: null,
        messageId: existing._id,
      };
    }

    const accounts = await ctx.db
      .query("telegramAccounts")
      .withIndex("by_school_telegram_user", (q) =>
        q.eq("schoolId", args.schoolId).eq("telegramUserId", args.telegramUserId),
      )
      .take(10);
    const account = accounts.find((candidate) => candidate.active) ?? null;

    if (!account?.active) {
      return {
        accepted: false,
        deduped: false,
        reason: "not_linked",
        messageId: null,
      };
    }

    const parserStatus =
      args.messageType === "voice"
        ? "ignored"
        : args.rawText?.trim()
          ? "pending"
          : "ignored";
    const parserDetails =
      args.messageType === "voice"
        ? "voice_not_supported"
        : args.rawText?.trim()
          ? undefined
          : "missing_text_content";

    const messageId = await ctx.db.insert("telegramMessages", {
      schoolId: args.schoolId,
      chatId: args.chatId,
      telegramMessageId: args.telegramMessageId,
      updateId: args.updateId,
      telegramUserId: args.telegramUserId,
      staffId: account.staffId,
      direction: "in",
      messageType: args.messageType,
      rawText: args.rawText,
      fileId: args.fileId,
      source: args.source,
      receivedAt: args.receivedAt,
      parserStatus,
      parserDetails,
      dedupeKey: args.dedupeKey,
    });

    return {
      accepted: true,
      deduped: false,
      reason: null,
      messageId,
    };
  },
});

export const processInbound = action({
  args: {
    messageId: v.id("telegramMessages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(getMessageByIdRef, {
      messageId: args.messageId,
    });
    if (!message || message.parserStatus !== "pending") {
      return { status: "skipped" };
    }

    if (!message.rawText?.trim()) {
      await ctx.runMutation(updateParserStatusRef, {
        messageId: args.messageId,
        parserStatus: "ignored",
        parserDetails: "missing_text_content",
      });
      return { status: "ignored", reason: "missing_text_content" };
    }

    if (!message.staffId) {
      await ctx.runMutation(updateParserStatusRef, {
        messageId: args.messageId,
        parserStatus: "error",
        parserDetails: "message_has_no_linked_staff",
      });
      return { status: "error", reason: "message_has_no_linked_staff" };
    }

    const school = await ctx.runQuery(getSchoolForMessageRef, {
      messageId: args.messageId,
    });
    if (!school) {
      await ctx.runMutation(updateParserStatusRef, {
        messageId: args.messageId,
        parserStatus: "error",
        parserDetails: "school_not_found_for_message",
      });
      return { status: "error", reason: "school_not_found_for_message" };
    }

    try {
      const extractionResult = await runTeacherMessageExtraction(message.rawText);
      const extraction = normalizeTeacherExtraction(extractionResult.extraction);

      if (extraction.kind === "attendance") {
        const classDoc = await ctx.runQuery(findClassByCodeRef, {
          schoolId: message.schoolId,
          code: extraction.classCode,
        });

        if (!classDoc) {
          throw new Error(`class_not_found:${extraction.classCode}`);
        }

        const schoolDate = schoolDateParts(message.receivedAt, school.timezone).date;
        await ctx.runMutation(upsertAttendanceFactRef, {
          schoolId: message.schoolId,
          date: schoolDate,
          classId: classDoc._id,
          sourceMessageId: message._id,
          presentCount: extraction.presentCount,
          absentCount: extraction.absentCount,
          mealCount: extraction.presentCount,
          confidence: extraction.confidence,
        });

        await ctx.runMutation(updateParserStatusRef, {
          messageId: message._id,
          parserStatus: "processed",
          parserDetails: `attendance:${extraction.classCode}`,
        });

        return extraction;
      }

      if (extraction.kind === "incident") {
        const incidentId = await ctx.runMutation(createIncidentRef, {
          schoolId: message.schoolId,
          sourceMessageId: message._id,
          reportedByStaffId: message.staffId,
          category: extraction.category ?? "facilities",
          title: extraction.title,
          description: extraction.description,
          location: extraction.location,
          severity: extraction.severity ?? "medium",
        });

        const candidates = await ctx.runQuery(listIncidentAssigneeCandidatesRef, {
          schoolId: message.schoolId,
        });
        const selection = selectIncidentAssignee(candidates);

        if (selection.assignee) {
          const taskIds = await ctx.runMutation(createTaskBatchRef, {
            schoolId: message.schoolId,
            tasks: [
              {
                source: "incident",
                title: extraction.title,
                description: extraction.description,
                assigneeStaffId: selection.assignee._id as Id<"staff">,
                creatorStaffId: message.staffId,
                priority: extraction.severity === "high" ? "high" : "medium",
                relatedIncidentId: incidentId,
              },
            ],
          });

          const linkedTaskId = taskIds[0];
          if (linkedTaskId) {
            await ctx.runMutation(enqueueNotificationRef, {
              schoolId: message.schoolId,
              recipientStaffId: selection.assignee._id as Id<"staff">,
              templateKey: "incident_task_created",
              payload: {
                text: `New incident task: ${extraction.title}\n${extraction.description}`,
              },
              scheduledFor: new Date().toISOString(),
              dedupeKey: `incident:${incidentId}:staff:${selection.assignee._id}`,
            });

            await ctx.runMutation(setIncidentAssignmentStateRef, {
              incidentId,
              assignmentStatus: "assigned",
              assignmentReason: selection.reason,
              linkedTaskId,
            });
          }
        } else {
          await ctx.runMutation(setIncidentAssignmentStateRef, {
            incidentId,
            assignmentStatus: "unassigned",
            assignmentReason: selection.reason,
          });
        }

        await ctx.runMutation(updateParserStatusRef, {
          messageId: message._id,
          parserStatus: "processed",
          parserDetails: `incident:${selection.reason}`,
        });

        return extraction;
      }

      await ctx.runMutation(updateParserStatusRef, {
        messageId: message._id,
        parserStatus: "ignored",
        parserDetails: extraction.reason ?? "classified_as_ignore",
      });

      return extraction;
    } catch (error) {
      const parserDetails =
        error instanceof Error ? error.message : "unknown_processing_error";
      await ctx.runMutation(updateParserStatusRef, {
        messageId: message._id,
        parserStatus: "error",
        parserDetails,
      });
      return {
        status: "error",
        reason: parserDetails,
      };
    }
  },
});

export const sendMessage = action({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx: ActionCtx, args: { notificationId: Id<"notifications"> }) => {
    return ctx.runAction(sendTelegramRef, args);
  },
});

export const debugAttendanceByChat = query({
  args: {
    schoolId: v.id("schools"),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("telegramAccounts")
      .withIndex("by_school_chat", (q) =>
        q.eq("schoolId", args.schoolId).eq("chatId", args.chatId),
      )
      .take(10);
    const account = accounts.find((candidate) => candidate.active) ?? accounts[0] ?? null;

    const messages = await ctx.db
      .query("telegramMessages")
      .withIndex("by_chat_message", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .take(10);

    const facts: Doc<"attendanceFacts">[] = [];
    for (const message of messages) {
      const fact = await ctx.db
        .query("attendanceFacts")
        .withIndex("by_source_message_id", (q) =>
          q.eq("sourceMessageId", message._id),
        )
        .unique();
      if (fact) {
        facts.push(fact);
      }
    }

    return {
      account,
      messages,
      facts,
    };
  },
});

export const debugIncidentByChat = query({
  args: {
    schoolId: v.id("schools"),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("telegramAccounts")
      .withIndex("by_school_chat", (q) =>
        q.eq("schoolId", args.schoolId).eq("chatId", args.chatId),
      )
      .take(10);
    const account = accounts.find((candidate) => candidate.active) ?? accounts[0] ?? null;

    const messages = await ctx.db
      .query("telegramMessages")
      .withIndex("by_chat_message", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .take(10);

    const incidents: Doc<"incidents">[] = [];
    const tasks: Doc<"tasks">[] = [];
    const notifications: Doc<"notifications">[] = [];

    for (const message of messages) {
      const incident = await ctx.db
        .query("incidents")
        .withIndex("by_source_message_id", (q) =>
          q.eq("sourceMessageId", message._id),
        )
        .unique();

      if (!incident) {
        continue;
      }

      incidents.push(incident);

      const task = incident.linkedTaskId
        ? await ctx.db.get(incident.linkedTaskId)
        : await ctx.db
            .query("tasks")
            .withIndex("by_related_incident", (q) =>
              q.eq("relatedIncidentId", incident._id),
            )
            .unique();

      if (task) {
        tasks.push(task);
        const notification = await ctx.db
          .query("notifications")
          .withIndex("by_dedupe_key", (q) =>
            q.eq("dedupeKey", `incident:${incident._id}:staff:${task.assigneeStaffId}`),
          )
          .unique();
        if (notification) {
          notifications.push(notification);
        }
      }
    }

    return {
      account,
      messages,
      incidents,
      tasks,
      notifications,
    };
  },
});

export const _getMessageById = query({
  args: {
    messageId: v.id("telegramMessages"),
  },
  handler: async (ctx, args) => ctx.db.get(args.messageId),
});

export const _getSchoolForMessage = query({
  args: {
    messageId: v.id("telegramMessages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }

    return ctx.db.get(message.schoolId);
  },
});

export const _findClassByCode = query({
  args: {
    schoolId: v.id("schools"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("classes")
      .withIndex("by_school_code", (q) =>
        q.eq("schoolId", args.schoolId).eq("code", args.code),
      )
      .unique();
  },
});

export const _listIncidentAssigneeCandidates = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("staff")
      .withIndex("by_school_role_active", (q) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true),
      )
      .collect();
  },
});

export const _updateParserStatus = mutation({
  args: {
    messageId: v.id("telegramMessages"),
    parserStatus: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("error"),
    ),
    parserDetails: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      parserStatus: args.parserStatus,
      parserDetails: args.parserDetails,
    });
    return args.messageId;
  },
});

export const _setIncidentAssignmentState = mutation({
  args: {
    incidentId: v.id("incidents"),
    assignmentStatus: v.union(v.literal("assigned"), v.literal("unassigned")),
    assignmentReason: v.string(),
    linkedTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.incidentId, {
      assignmentStatus: args.assignmentStatus,
      assignmentReason: args.assignmentReason,
      linkedTaskId: args.linkedTaskId,
    });
    return args.incidentId;
  },
});

export const _getTelegramAccountByStaff = query({
  args: {
    schoolId: v.id("schools"),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("telegramAccounts")
      .withIndex("by_school_staff", (q) =>
        q.eq("schoolId", args.schoolId).eq("staffId", args.staffId),
      )
      .take(10);

    return accounts.find((account) => account.active) ?? null;
  },
});
