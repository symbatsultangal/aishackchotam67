import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import {
  actionGeneric,
  internalActionGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";

import { publicRef } from "../../lib/functionRefs";
import { getRequiredEnv } from "../../lib/env";
import { sendTelegramText } from "../../lib/integrations/telegram";
import { nowIsoString } from "../../lib/time";
import { notificationStatusValidator } from "../../lib/validators";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;
const action: any = actionGeneric;
const internalAction: any = internalActionGeneric;

const getByIdRef = publicRef<
  "query",
  { notificationId: Id<"notifications"> },
  {
    _id: Id<"notifications">;
    schoolId: Id<"schools">;
    recipientStaffId: Id<"staff">;
    payload: any;
  } | null
>("modules/ops/notifications:_getById");

const getTelegramAccountByStaffRef = publicRef<
  "query",
  { schoolId: Id<"schools">; staffId: Id<"staff"> },
  { chatId: string } | null
>("modules/ops/telegram:_getTelegramAccountByStaff");

const setStatusRef = publicRef<
  "mutation",
  { notificationId: Id<"notifications">; status: "queued" | "sending" | "sent" | "error" },
  Id<"notifications">
>("modules/ops/notifications:_setStatus");

const markSentRef = publicRef<
  "mutation",
  {
    notificationId: Id<"notifications">;
    externalMessageId?: string;
    status: "sent" | "error";
  },
  Id<"notifications">
>("modules/ops/notifications:markSent");

const listDueRef = publicRef<
  "query",
  { nowIso: string },
  Array<{ _id: Id<"notifications"> }>
>("modules/ops/notifications:_listDue");

const sendTelegramRef = publicRef<
  "action",
  { notificationId: Id<"notifications"> },
  unknown
>("modules/ops/notifications:sendTelegram");

export const enqueue = mutation({
  args: {
    schoolId: v.id("schools"),
    recipientStaffId: v.id("staff"),
    templateKey: v.string(),
    payload: v.any(),
    scheduledFor: v.string(),
    dedupeKey: v.string(),
  },
  handler: async (ctx: MutationCtx, args: {
    schoolId: Id<"schools">;
    recipientStaffId: Id<"staff">;
    templateKey: string;
    payload: any;
    scheduledFor: string;
    dedupeKey: string;
  }) => {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_dedupe_key", (q: any) => q.eq("dedupeKey", args.dedupeKey))
      .unique();
    if (existing) {
      return existing._id;
    }

    return ctx.db.insert("notifications", {
      schoolId: args.schoolId,
      channel: "telegram",
      recipientStaffId: args.recipientStaffId,
      templateKey: args.templateKey,
      payload: args.payload,
      status: "queued",
      scheduledFor: args.scheduledFor,
      dedupeKey: args.dedupeKey,
    });
  },
});

export const markSent = mutation({
  args: {
    notificationId: v.id("notifications"),
    externalMessageId: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("error")),
  },
  handler: async (ctx: MutationCtx, args: {
    notificationId: Id<"notifications">;
    externalMessageId?: string;
    status: "sent" | "error";
  }) => {
    await ctx.db.patch(args.notificationId, {
      status: args.status,
      externalMessageId: args.externalMessageId,
      sentAt: args.status === "sent" ? nowIsoString() : undefined,
    });
    return args.notificationId;
  },
});

export const listRecent = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx: QueryCtx, args: { schoolId: Id<"schools"> }) => {
    return ctx.db
      .query("notifications")
      .withIndex("by_school_status_scheduledFor", (q: any) =>
        q.eq("schoolId", args.schoolId),
      )
      .take(50);
  },
});

export const sendTelegram = action({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx: ActionCtx, args: { notificationId: Id<"notifications"> }) => {
    const notification = await ctx.runQuery(getByIdRef, {
      notificationId: args.notificationId,
    });
    if (!notification) {
      throw new Error("Notification not found");
    }

    const account = await ctx.runQuery(getTelegramAccountByStaffRef, {
      schoolId: notification.schoolId,
      staffId: notification.recipientStaffId,
    });
    if (!account) {
      throw new Error("Telegram account not found for recipient");
    }

    const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
    const payloadText =
      typeof notification.payload?.text === "string"
        ? notification.payload.text
        : JSON.stringify(notification.payload, null, 2);

    await ctx.runMutation(setStatusRef, {
      notificationId: args.notificationId,
      status: "sending",
    });

    const response = (await sendTelegramText({
      botToken,
      chatId: account.chatId,
      text: payloadText,
    })) as { result?: { message_id?: number } };

    await ctx.runMutation(markSentRef, {
      notificationId: args.notificationId,
      status: "sent",
      externalMessageId: response?.result?.message_id?.toString(),
    });

    return response;
  },
});

export const dispatchDue = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<number> => {
    const due: Array<{ _id: Id<"notifications"> }> = await ctx.runQuery(listDueRef, {
      nowIso: nowIsoString(),
    });

    for (const notification of due) {
      await ctx.scheduler.runAfter(0, sendTelegramRef, {
        notificationId: notification._id,
      });
    }

    return due.length;
  },
});

export const _getById = query({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx: QueryCtx, args: { notificationId: Id<"notifications"> }) => {
    return ctx.db.get(args.notificationId);
  },
});

export const _listDue = query({
  args: {
    nowIso: v.string(),
  },
  handler: async (ctx: QueryCtx, args: { nowIso: string }) => {
    const notifications = await ctx.db.query("notifications").collect();

    return notifications.filter(
      (notification: any) =>
        notification.status === "queued" && notification.scheduledFor <= args.nowIso,
    );
  },
});

export const _setStatus = mutation({
  args: {
    notificationId: v.id("notifications"),
    status: notificationStatusValidator,
  },
  handler: async (ctx: MutationCtx, args: {
    notificationId: Id<"notifications">;
    status: "queued" | "sending" | "sent" | "error";
  }) => {
    await ctx.db.patch(args.notificationId, { status: args.status });
    return args.notificationId;
  },
});
