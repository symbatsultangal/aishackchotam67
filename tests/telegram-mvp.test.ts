import { describe, expect, test } from "vitest";

import {
  buildTelegramDedupeKey,
  generateInviteCode,
  normalizeInviteCode,
  selectIncidentAssignee,
  shouldSendTelegramAck,
} from "../convex/lib/telegramMvp";

describe("normalizeInviteCode", () => {
  test("trims whitespace and uppercases the invite code", () => {
    expect(normalizeInviteCode("  ab12cd34  ")).toBe("AB12CD34");
  });
});

describe("generateInviteCode", () => {
  test("builds an 8-character uppercase alphanumeric invite code", () => {
    const code = generateInviteCode(
      new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
    );

    expect(code).toBe("ABCDEFGH");
  });
});

describe("buildTelegramDedupeKey", () => {
  test("uses chat id and telegram message id as the dedupe key", () => {
    expect(buildTelegramDedupeKey("123456789", "101")).toBe("123456789:101");
  });
});

describe("shouldSendTelegramAck", () => {
  test("acks only newly accepted inbound messages", () => {
    expect(
      shouldSendTelegramAck({
        accepted: true,
        deduped: false,
        ackText: "✓ received",
      }),
    ).toBe(true);

    expect(
      shouldSendTelegramAck({
        accepted: true,
        deduped: true,
        ackText: "✓ received",
      }),
    ).toBe(false);

    expect(
      shouldSendTelegramAck({
        accepted: false,
        deduped: false,
        ackText: "Please link first",
      }),
    ).toBe(false);
  });
});

describe("selectIncidentAssignee", () => {
  test("prefers facilities staff over admin and director fallbacks", () => {
    const result = selectIncidentAssignee([
      {
        _id: "staff_admin",
        fullName: "Zarina Admin",
        roles: ["admin"],
        isActive: true,
      },
      {
        _id: "staff_facilities",
        fullName: "Ayan Facilities",
        roles: ["facilities"],
        isActive: true,
      },
    ]);

    expect(result).toMatchObject({
      assignee: {
        _id: "staff_facilities",
      },
      fallbackRole: "facilities",
      reason: "matched_active_facilities",
    });
  });

  test("falls back to the alphabetically first admin when facilities is missing", () => {
    const result = selectIncidentAssignee([
      {
        _id: "staff_admin_b",
        fullName: "Zhanar Admin",
        roles: ["admin"],
        isActive: true,
      },
      {
        _id: "staff_admin_a",
        fullName: "Aigerim Admin",
        roles: ["admin"],
        isActive: true,
      },
    ]);

    expect(result).toMatchObject({
      assignee: {
        _id: "staff_admin_a",
      },
      fallbackRole: "admin",
      reason: "matched_active_admin",
    });
  });

  test("returns an unassigned outcome when no eligible active assignee exists", () => {
    const result = selectIncidentAssignee([
      {
        _id: "staff_teacher",
        fullName: "Teacher One",
        roles: ["teacher"],
        isActive: true,
      },
    ]);

    expect(result).toEqual({
      assignee: null,
      fallbackRole: null,
      reason: "no_active_incident_assignee",
    });
  });
});
