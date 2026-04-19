import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

import { getRequiredEnv } from "./lib/env";
import { publicRef } from "./lib/functionRefs";
import { buildTelegramDedupeKey } from "./lib/telegramMvp";

const http = httpRouter();

const storeInboundRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    chatId: string;
    telegramMessageId: string;
    updateId?: number;
    telegramUserId: string;
    rawText?: string;
    fileId?: string;
    messageType: "text" | "voice";
    source?: "polling" | "webhook";
    receivedAt: string;
    dedupeKey: string;
  },
  {
    accepted: boolean;
    deduped: boolean;
    reason: string | null;
    messageId: Id<"telegramMessages"> | null;
  }
>("modules/ops/telegram:storeInbound");

const redeemInviteCodeRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    code: string;
    telegramUserId: string;
    chatId: string;
    username?: string;
    firstName?: string;
  },
  unknown
>("modules/ops/telegramInviteCodes:redeemInviteCode");

const processInboundRef = publicRef<
  "action",
  { messageId: Id<"telegramMessages"> },
  unknown
>("modules/ops/telegram:processInbound");

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function isAdapterAuthorized(request: Request): boolean {
  const secret = getRequiredEnv("TELEGRAM_INGRESS_SECRET");
  return request.headers.get("x-telegram-adapter-secret") === secret;
}

http.route({
  path: "/telegram/health",
  method: "GET",
  handler: httpAction(async () => jsonResponse({ ok: true })),
});

http.route({
  path: "/telegram/link/redeem",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAdapterAuthorized(request)) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    const payload = await request.json();
    if (
      typeof payload?.schoolId !== "string" ||
      typeof payload?.code !== "string" ||
      typeof payload?.telegramUserId !== "string" ||
      typeof payload?.chatId !== "string"
    ) {
      return jsonResponse({ ok: false, error: "invalid_payload" }, 400);
    }

    const result = await ctx.runMutation(redeemInviteCodeRef, {
      schoolId: payload.schoolId as Id<"schools">,
      code: payload.code,
      telegramUserId: payload.telegramUserId,
      chatId: payload.chatId,
      username:
        typeof payload.username === "string" ? payload.username : undefined,
      firstName:
        typeof payload.firstName === "string" ? payload.firstName : undefined,
    });

    return jsonResponse(result);
  }),
});

http.route({
  path: "/telegram/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAdapterAuthorized(request)) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    const payload = await request.json();
    if (
      typeof payload?.schoolId !== "string" ||
      typeof payload?.message?.telegramMessageId !== "string" ||
      typeof payload?.message?.telegramUserId !== "string" ||
      typeof payload?.message?.chatId !== "string" ||
      typeof payload?.message?.chatType !== "string" ||
      typeof payload?.message?.sentAt !== "string"
    ) {
      return jsonResponse({ ok: false, error: "invalid_payload" }, 400);
    }

    if (payload.message.chatType !== "private") {
      return jsonResponse({
        ok: true,
        accepted: false,
        reason: "not_private",
        ackText: null,
      });
    }

    const inbound = await ctx.runMutation(storeInboundRef, {
      schoolId: payload.schoolId as Id<"schools">,
      chatId: payload.message.chatId,
      telegramMessageId: payload.message.telegramMessageId,
      updateId:
        typeof payload.updateId === "number" ? payload.updateId : undefined,
      telegramUserId: payload.message.telegramUserId,
      rawText:
        typeof payload.message.text === "string" ? payload.message.text : undefined,
      messageType: "text",
      source: payload.source === "webhook" ? "webhook" : "polling",
      receivedAt: payload.message.sentAt,
      dedupeKey: buildTelegramDedupeKey(
        payload.message.chatId,
        payload.message.telegramMessageId,
      ),
    });

    if (inbound.accepted && !inbound.deduped && inbound.messageId) {
      await ctx.scheduler.runAfter(0, processInboundRef, {
        messageId: inbound.messageId,
      });
    }

    if (!inbound.accepted) {
      return jsonResponse({
        ok: true,
        accepted: false,
        reason: inbound.reason ?? "rejected",
        ackText: "Please link your account first with /start <code>.",
      });
    }

    return jsonResponse({
      ok: true,
      accepted: true,
      deduped: inbound.deduped,
      messageRecordId: inbound.messageId,
      ackText: inbound.deduped ? null : "✓ received",
    });
  }),
});

http.route({
  path: "/telegram/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const schoolId = new URL(request.url).searchParams.get("schoolId");
    if (!schoolId) {
      return new Response("Missing schoolId", { status: 400 });
    }

    const payload = await request.json();
    const message = payload?.message;
    if (!message?.from || !message?.chat) {
      return jsonResponse({ ignored: true });
    }

    if (message.chat.type !== "private") {
      return jsonResponse({ ignored: true, reason: "not_private" });
    }

    const text = message.text ?? message.caption ?? undefined;
    const voiceFileId = message.voice?.file_id ?? undefined;
    const receivedAt =
      typeof message.date === "number"
        ? new Date(message.date * 1000).toISOString()
        : new Date().toISOString();

    const inbound = await ctx.runMutation(storeInboundRef, {
      schoolId: schoolId as Id<"schools">,
      chatId: String(message.chat.id),
      telegramMessageId: String(message.message_id),
      updateId:
        typeof payload.update_id === "number" ? payload.update_id : undefined,
      telegramUserId: String(message.from.id),
      rawText: text,
      fileId: voiceFileId,
      messageType: voiceFileId ? "voice" : "text",
      source: "webhook",
      receivedAt,
      dedupeKey: buildTelegramDedupeKey(
        String(message.chat.id),
        String(message.message_id),
      ),
    });

    if (inbound.accepted && !inbound.deduped && inbound.messageId) {
      await ctx.scheduler.runAfter(0, processInboundRef, {
        messageId: inbound.messageId,
      });
    }

    return jsonResponse({
      ok: true,
      accepted: inbound.accepted,
      deduped: inbound.deduped,
      reason: inbound.reason,
    });
  }),
});

export default http;
