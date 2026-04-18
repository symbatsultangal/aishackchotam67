import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

import { publicRef } from "./lib/functionRefs";
import { getRequiredEnv } from "./lib/env";

const http = httpRouter();

const storeInboundRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    chatId: string;
    telegramMessageId: string;
    telegramUserId: string;
    rawText?: string;
    fileId?: string;
    messageType: "text" | "voice";
    dedupeKey: string;
  },
  Id<"telegramMessages">
>("modules/ops/telegram:storeInbound");

const processInboundRef = publicRef<
  "action",
  { messageId: Id<"telegramMessages"> },
  unknown
>("modules/ops/telegram:processInbound");

http.route({
  path: "/telegram/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
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
      return new Response(JSON.stringify({ ignored: true }), { status: 200 });
    }

    if (message.chat.type !== "private") {
      return new Response(JSON.stringify({ ignored: true, reason: "not_private" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const text = message.text ?? message.caption ?? undefined;
    const voiceFileId = message.voice?.file_id ?? undefined;
    const messageId = await ctx.runMutation(storeInboundRef, {
      schoolId: schoolId as Id<"schools">,
      chatId: String(message.chat.id),
      telegramMessageId: String(message.message_id),
      telegramUserId: String(message.from.id),
      rawText: text,
      fileId: voiceFileId,
      messageType: voiceFileId ? "voice" : "text",
      dedupeKey: `${message.chat.id}:${message.message_id}`,
    });

    await ctx.scheduler.runAfter(0, processInboundRef, {
      messageId,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
});

export default http;
