type Role =
  | "director"
  | "vice_principal"
  | "teacher"
  | "admin"
  | "facilities"
  | "kitchen";

const INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type TelegramAckDecision = {
  accepted: boolean;
  deduped: boolean;
  ackText?: string | null;
};

export type IncidentAssigneeCandidate = {
  _id: string;
  fullName: string;
  roles: Role[];
  isActive: boolean;
};

export type IncidentAssigneeSelection = {
  assignee: IncidentAssigneeCandidate | null;
  fallbackRole: "facilities" | "admin" | "director" | null;
  reason: string;
};

export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

export function generateInviteCode(randomValues?: Uint8Array): string {
  const values = randomValues ?? crypto.getRandomValues(new Uint8Array(8));
  return Array.from(values)
    .slice(0, 8)
    .map((value) => INVITE_CODE_ALPHABET[value % INVITE_CODE_ALPHABET.length])
    .join("");
}

export function buildTelegramDedupeKey(
  chatId: string,
  telegramMessageId: string,
): string {
  return `${chatId}:${telegramMessageId}`;
}

export function shouldSendTelegramAck(decision: TelegramAckDecision): boolean {
  return (
    decision.accepted &&
    !decision.deduped &&
    typeof decision.ackText === "string" &&
    decision.ackText.trim().length > 0
  );
}

export function isInviteExpired(
  expiresAt: string,
  nowIso: string = new Date().toISOString(),
): boolean {
  return expiresAt <= nowIso;
}

export function selectIncidentAssignee(
  candidates: IncidentAssigneeCandidate[],
): IncidentAssigneeSelection {
  const sortedActive = candidates
    .filter((candidate) => candidate.isActive)
    .slice()
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const roleOrder: Array<{
    role: "facilities" | "admin" | "director";
    reason: string;
  }> = [
    { role: "facilities", reason: "matched_active_facilities" },
    { role: "admin", reason: "matched_active_admin" },
    { role: "director", reason: "matched_active_director" },
  ];

  for (const choice of roleOrder) {
    const assignee =
      sortedActive.find((candidate) => candidate.roles.includes(choice.role)) ?? null;
    if (assignee) {
      return {
        assignee,
        fallbackRole: choice.role,
        reason: choice.reason,
      };
    }
  }

  return {
    assignee: null,
    fallbackRole: null,
    reason: "no_active_incident_assignee",
  };
}
