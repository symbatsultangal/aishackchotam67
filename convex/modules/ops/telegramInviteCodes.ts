import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";

import {
  generateInviteCode,
  isInviteExpired,
  normalizeInviteCode,
} from "../../lib/telegramMvp";

function deriveTelegramAccountKind(roles: string[]): "teacher" | "director" | "admin" {
  if (roles.includes("director")) {
    return "director";
  }
  if (roles.includes("teacher")) {
    return "teacher";
  }
  return "admin";
}

export const createInviteCode = mutation({
  args: {
    schoolId: v.id("schools"),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.schoolId !== args.schoolId) {
      throw new Error("Staff member not found for school");
    }

    const activeCodes = await ctx.db
      .query("telegramInviteCodes")
      .withIndex("by_school_staff_status", (q) =>
        q.eq("schoolId", args.schoolId).eq("staffId", args.staffId).eq("status", "active"),
      )
      .take(10);

    for (const activeCode of activeCodes) {
      await ctx.db.patch(activeCode._id, {
        status: "revoked",
      });
    }

    let code = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateInviteCode();
      const existing = await ctx.db
        .query("telegramInviteCodes")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .unique();
      if (!existing) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new Error("Failed to generate a unique invite code");
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const inviteCodeId = await ctx.db.insert("telegramInviteCodes", {
      schoolId: args.schoolId,
      staffId: args.staffId,
      code,
      status: "active",
      expiresAt,
    });

    return {
      inviteCodeId,
      code,
      expiresAt,
    };
  },
});

export const listInviteCodes = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("telegramInviteCodes")
      .withIndex("by_school_status_expiresAt", (q) => q.eq("schoolId", args.schoolId))
      .order("desc")
      .take(50);
  },
});

export const redeemInviteCode = mutation({
  args: {
    schoolId: v.id("schools"),
    code: v.string(),
    telegramUserId: v.string(),
    chatId: v.string(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedCode = normalizeInviteCode(args.code);
    const invite = await ctx.db
      .query("telegramInviteCodes")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .unique();

    if (!invite || invite.schoolId !== args.schoolId) {
      return {
        ok: true,
        linked: false,
        reason: "invalid_code",
        replyText: "This code is invalid or expired. Ask the admin for a new one.",
      } as const;
    }

    if (invite.status !== "active") {
      return {
        ok: true,
        linked: false,
        reason: invite.status === "expired" ? "expired_code" : "invalid_code",
        replyText: "This code is invalid or expired. Ask the admin for a new one.",
      } as const;
    }

    if (isInviteExpired(invite.expiresAt)) {
      await ctx.db.patch(invite._id, {
        status: "expired",
      });
      return {
        ok: true,
        linked: false,
        reason: "expired_code",
        replyText: "This code is invalid or expired. Ask the admin for a new one.",
      } as const;
    }

    const staff = await ctx.db.get(invite.staffId);
    if (!staff) {
      return {
        ok: true,
        linked: false,
        reason: "invalid_code",
        replyText: "This code is invalid or expired. Ask the admin for a new one.",
      } as const;
    }

    const staffAccounts = await ctx.db
      .query("telegramAccounts")
      .withIndex("by_school_staff", (q) =>
        q.eq("schoolId", args.schoolId).eq("staffId", invite.staffId),
      )
      .take(10);

    if (staffAccounts.some((account) => account.active)) {
      return {
        ok: true,
        linked: false,
        reason: "already_linked",
        replyText:
          "This staff member is already linked to Telegram. Ask the admin if you need to relink it.",
      } as const;
    }

    const existingUserAccounts = await ctx.db
      .query("telegramAccounts")
      .withIndex("by_school_telegram_user", (q) =>
        q.eq("schoolId", args.schoolId).eq("telegramUserId", args.telegramUserId),
      )
      .take(10);
    const existingUserAccount =
      existingUserAccounts.find((account) => account.active) ?? null;

    if (existingUserAccount?.active) {
      return {
        ok: true,
        linked: false,
        reason: "telegram_user_already_linked",
        replyText:
          "This Telegram account is already linked to another staff member. Ask the admin to relink it.",
      } as const;
    }

    const reusableAccount = staffAccounts.find((account) => !account.active) ?? null;
    const kind = deriveTelegramAccountKind(staff.roles);

    if (reusableAccount) {
      await ctx.db.patch(reusableAccount._id, {
        telegramUserId: args.telegramUserId,
        username: args.username,
        chatId: args.chatId,
        kind,
        active: true,
      });
    } else {
      await ctx.db.insert("telegramAccounts", {
        schoolId: args.schoolId,
        staffId: invite.staffId,
        telegramUserId: args.telegramUserId,
        username: args.username,
        chatId: args.chatId,
        kind,
        active: true,
      });
    }

    await ctx.db.patch(invite._id, {
      status: "redeemed",
      redeemedAt: new Date().toISOString(),
      redeemedTelegramUserId: args.telegramUserId,
      redeemedChatId: args.chatId,
    });

    return {
      ok: true,
      linked: true,
      staffId: invite.staffId,
      displayName: staff.displayName,
      replyText: "Your account is linked. You can now send attendance or incident messages.",
    } as const;
  },
});
