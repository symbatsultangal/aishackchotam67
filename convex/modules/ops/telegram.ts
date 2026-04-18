import { action, mutation, query, type ActionCtx } from "../../_generated/server";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";

import { publicRef } from "../../lib/functionRefs";
import { runTeacherMessageExtraction } from "../../lib/ai/extraction";
import { nowIsoString, schoolDateParts } from "../../lib/time";
import { normalizeTeacherExtraction } from "../../lib/validators";

const getMessageByIdRef = publicRef<
  "query",
  { messageId: Id<"telegramMessages"> },
  {
    _id: Id<"telegramMessages">;
    schoolId: Id<"schools">;
    staffId?: Id<"staff">;
    rawText?: string;
    parserStatus: "pending" | "processed" | "ignored" | "error";
    receivedAt: string;
  } | null
>("modules/ops/telegram:_getMessageById");

const getSchoolForMessageRef = publicRef<
  "query",
  { messageId: Id<"telegramMessages"> },
  { _id: Id<"schools">; timezone: string } | null
>("modules/ops/telegram:_getSchoolForMessage");

const findClassByCodeRef = publicRef<
  "query",
  { schoolId: Id<"schools">; code: string },
  { _id: Id<"classes"> } | null
>("modules/ops/telegram:_findClassByCode");

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
    reportedByStaffId?: Id<"staff">;
    category: string;
    title: string;
    description: string;
    location?: string;
    severity: "low" | "medium" | "high";
  },
  Id<"incidents">
>("modules/ops/incidents:createFromParse");

const findFacilitiesAssigneeRef = publicRef<
  "query",
  { schoolId: Id<"schools"> },
  { _id: Id<"staff"> } | null
>("modules/ops/telegram:_findFacilitiesAssignee");

const createTaskBatchRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    tasks: Array<{
      source: "incident";
      title: string;
      description: string;
      assigneeStaffId: Id<"staff">;
      creatorStaffId?: Id<"staff">;
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
    payload: any;
    scheduledFor: string;
    dedupeKey: string;
  },
  Id<"notifications">
>("modules/ops/notifications:enqueue");

const linkIncidentTaskRef = publicRef<
  "mutation",
  { incidentId: Id<"incidents">; taskId: Id<"tasks"> },
  Id<"incidents">
>("modules/ops/telegram:_linkIncidentTask");

const updateParserStatusRef = publicRef<
  "mutation",
  {
    messageId: Id<"telegramMessages">;
    parserStatus: "pending" | "processed" | "ignored" | "error";
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
    telegramUserId: v.string(),
    rawText: v.optional(v.string()),
    fileId: v.optional(v.string()),
    messageType: v.union(v.literal("text"), v.literal("voice")),
    dedupeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegramMessages")
      .withIndex("by_dedupe_key", (q: any) => q.eq("dedupeKey", args.dedupeKey))
      .unique();
    if (existing) {
      return existing._id;
    }

    const account = await ctx.db
      .query("telegramAccounts")
      .withIndex("by_school_telegram_user", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("telegramUserId", args.telegramUserId),
      )
      .unique();

    return ctx.db.insert("telegramMessages", {
      schoolId: args.schoolId,
      chatId: args.chatId,
      telegramMessageId: args.telegramMessageId,
      telegramUserId: args.telegramUserId,
      staffId: account?._id ? account.staffId : undefined,
      direction: "in",
      messageType: args.messageType,
      rawText: args.rawText,
      fileId: args.fileId,
      receivedAt: nowIsoString(),
      parserStatus: "pending",
      dedupeKey: args.dedupeKey,
    });
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
    if (!message || message.parserStatus !== "pending" || !message.rawText) {
      return { status: "skipped" };
    }

    const school = await ctx.runQuery(getSchoolForMessageRef, {
      messageId: args.messageId,
    });
    if (!school) {
      throw new Error("School not found for message");
    }

    const extractionResult = await runTeacherMessageExtraction(message.rawText);
    const extraction = normalizeTeacherExtraction(extractionResult.extraction);

    if (extraction.kind === "attendance") {
      const classDoc = await ctx.runQuery(findClassByCodeRef, {
        schoolId: message.schoolId,
        code: extraction.classCode,
      });
      if (!classDoc) {
        throw new Error(`Class not found for code ${extraction.classCode}`);
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
    } else if (extraction.kind === "incident") {
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

      const facilitiesStaff = await ctx.runQuery(findFacilitiesAssigneeRef, {
        schoolId: message.schoolId,
      });
      if (facilitiesStaff) {
        const taskIds = await ctx.runMutation(createTaskBatchRef, {
          schoolId: message.schoolId,
          tasks: [
            {
              source: "incident",
              title: extraction.title,
              description: extraction.description,
              assigneeStaffId: facilitiesStaff._id,
              creatorStaffId: message.staffId,
              priority: extraction.severity === "high" ? "high" : "medium",
              relatedIncidentId: incidentId,
            },
          ],
        });

        await ctx.runMutation(enqueueNotificationRef, {
          schoolId: message.schoolId,
          recipientStaffId: facilitiesStaff._id,
          templateKey: "incident_task_created",
          payload: {
            text: `New incident task: ${extraction.title}\n${extraction.description}`,
          },
          scheduledFor: nowIsoString(),
          dedupeKey: `incident:${incidentId}:staff:${facilitiesStaff._id}`,
        });

        if (taskIds[0]) {
          await ctx.runMutation(linkIncidentTaskRef, {
            incidentId,
            taskId: taskIds[0],
          });
        }
      }
    }

    await ctx.runMutation(updateParserStatusRef, {
      messageId: message._id,
      parserStatus: extraction.kind === "ignore" ? "ignored" : "processed",
    });

    return extraction;
  },
});

export const sendMessage = action({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (
    ctx: ActionCtx,
    args: { notificationId: Id<"notifications"> },
  ) => {
    return ctx.runAction(sendTelegramRef, args);
  },
});

export const _getMessageById = query({
  args: {
    messageId: v.id("telegramMessages"),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.messageId);
  },
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
      .withIndex("by_school_code", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("code", args.code),
      )
      .unique();
  },
});

export const _findFacilitiesAssignee = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_school_role_active", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true),
      )
      .collect();
    return staff.find((row: any) => row.roles.includes("facilities")) ?? null;
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { parserStatus: args.parserStatus });
    return args.messageId;
  },
});

export const _linkIncidentTask = mutation({
  args: {
    incidentId: v.id("incidents"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.incidentId, { linkedTaskId: args.taskId });
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
      .withIndex("by_school_staff", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("staffId", args.staffId),
      )
      .collect();
    return accounts.find((account: any) => account.active) ?? null;
  },
});
