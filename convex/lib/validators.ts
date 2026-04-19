import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("director"),
  v.literal("vice_principal"),
  v.literal("teacher"),
  v.literal("admin"),
  v.literal("facilities"),
  v.literal("kitchen"),
);

export const roleListValidator = v.array(roleValidator);

export const taskSourceValidator = v.union(
  v.literal("incident"),
  v.literal("voice"),
  v.literal("manual"),
  v.literal("compliance"),
);

export const taskPriorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const taskStatusValidator = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("canceled"),
);

export const incidentSeverityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

export const incidentStatusValidator = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("resolved"),
);

export const incidentAssignmentStatusValidator = v.union(
  v.literal("assigned"),
  v.literal("unassigned"),
);

export const telegramMessageTypeValidator = v.union(
  v.literal("text"),
  v.literal("voice"),
);

export const telegramParserStatusValidator = v.union(
  v.literal("pending"),
  v.literal("transcribing"),
  v.literal("processed"),
  v.literal("ignored"),
  v.literal("error"),
);

export const telegramInviteCodeStatusValidator = v.union(
  v.literal("active"),
  v.literal("redeemed"),
  v.literal("expired"),
  v.literal("revoked"),
);

export const telegramIngressSourceValidator = v.union(
  v.literal("polling"),
  v.literal("webhook"),
);

export const voiceCommandStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("transcribed"),
  v.literal("planned"),
  v.literal("routed"),
  v.literal("error"),
);

export const voiceCommandIntentValidator = v.union(
  v.literal("task_batch"),
  v.literal("substitution"),
  v.literal("order_draft"),
  v.literal("unclear"),
);

export const substitutionRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("ranked"),
  v.literal("confirmed"),
  v.literal("applied"),
  v.literal("error"),
);

export const scheduleOverrideStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("confirmed"),
  v.literal("applied"),
  v.literal("canceled"),
);

export const assessmentKindValidator = v.union(
  v.literal("tjb"),
  v.literal("bjb"),
);

export const documentParseStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("parsed"),
  v.literal("embedded"),
  v.literal("error"),
);

export const complianceTargetTypeValidator = v.union(
  v.literal("task"),
  v.literal("schedule_override"),
  v.literal("freeform"),
);

export const complianceResultValidator = v.union(
  v.literal("pass"),
  v.literal("warn"),
  v.literal("fail"),
);

export const notificationStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("error"),
);

export const aiRunStatusValidator = v.union(
  v.literal("started"),
  v.literal("completed"),
  v.literal("error"),
);

export const staffSeedMemberFields = {
  fullName: v.string(),
  displayName: v.string(),
  roles: roleListValidator,
  subjects: v.array(v.string()),
  grades: v.array(v.string()),
  qualifications: v.array(v.string()),
  telegramEnabled: v.boolean(),
  dashboardAccess: v.boolean(),
  isActive: v.boolean(),
};

export const staffSeedMemberValidator = v.object(staffSeedMemberFields);

export const classSeedItemFields = {
  code: v.string(),
  grade: v.string(),
  homeroomTeacherId: v.optional(v.id("staff")),
  active: v.boolean(),
};

export const classSeedItemValidator = v.object(classSeedItemFields);

export const roomSeedItemFields = {
  code: v.string(),
  capacity: v.optional(v.number()),
  active: v.boolean(),
};

export const roomSeedItemValidator = v.object(roomSeedItemFields);

export const roomDetailSeedItemFields = {
  code: v.string(),
  capacity: v.optional(v.number()),
  active: v.optional(v.boolean()),
  floor: v.optional(v.number()),
  homeClassCode: v.optional(v.string()),
  managerName: v.optional(v.string()),
  description: v.optional(v.string()),
};

export const roomDetailSeedItemValidator = v.object(roomDetailSeedItemFields);

export const timeSlotSeedItemFields = {
  weekday: v.number(),
  lessonNumber: v.number(),
  startTime: v.string(),
  endTime: v.string(),
};

export const timeSlotSeedItemValidator = v.object(timeSlotSeedItemFields);

export const scheduleSeedEntryFields = {
  classId: v.id("classes"),
  weekday: v.number(),
  lessonNumber: v.number(),
  subject: v.string(),
  teacherId: v.id("staff"),
  roomId: v.id("rooms"),
  subjectRequirement: v.optional(v.string()),
};

export const scheduleSeedEntryValidator = v.object(scheduleSeedEntryFields);

export const scheduleCompositeComponentFields = {
  subject: v.string(),
  teacherName: v.optional(v.string()),
  teacherId: v.optional(v.id("staff")),
  roomCode: v.optional(v.string()),
  roomId: v.optional(v.id("rooms")),
  notes: v.optional(v.string()),
};

export const scheduleCompositeComponentValidator = v.object(
  scheduleCompositeComponentFields,
);

export const scheduleCompositeSeedEntryFields = {
  classId: v.id("classes"),
  weekday: v.number(),
  lessonNumber: v.number(),
  rawCellText: v.string(),
  rawRoomText: v.optional(v.string()),
  sourceSheet: v.optional(v.string()),
  sourceRowKey: v.optional(v.string()),
  active: v.boolean(),
  components: v.array(scheduleCompositeComponentValidator),
};

export const scheduleCompositeSeedEntryValidator = v.object(
  scheduleCompositeSeedEntryFields,
);

export const staffLoadClassLoadFields = {
  classCode: v.string(),
  load: v.number(),
};

export const staffLoadClassLoadValidator = v.object(staffLoadClassLoadFields);

export const staffLoadBandLoadFields = {
  label: v.string(),
  load: v.number(),
};

export const staffLoadBandLoadValidator = v.object(staffLoadBandLoadFields);

export const staffLoadSubjectFields = {
  subject: v.string(),
  classLoads: v.array(staffLoadClassLoadValidator),
  bandLoads: v.array(staffLoadBandLoadValidator),
  totalLoad: v.optional(v.number()),
};

export const staffLoadSubjectValidator = v.object(staffLoadSubjectFields);

export const staffLoadProfileFields = {
  staffId: v.id("staff"),
  academicYear: v.string(),
  sourceSheet: v.optional(v.string()),
  diplomaSpecialty: v.optional(v.string()),
  weeklyLoadTarget: v.optional(v.number()),
  totalAssignedLoad: v.optional(v.number()),
  subjectLoads: v.array(staffLoadSubjectValidator),
  notes: v.optional(v.string()),
};

export const staffLoadProfileValidator = v.object(staffLoadProfileFields);

export const assessmentSeedEntryFields = {
  kind: assessmentKindValidator,
  sourceSheet: v.string(),
  sourceRowKey: v.string(),
  subject: v.string(),
  classId: v.optional(v.id("classes")),
  classCode: v.optional(v.string()),
  gradeLabel: v.optional(v.string()),
  scheduledDate: v.optional(v.string()),
  lessonNumber: v.optional(v.number()),
  timeLabel: v.optional(v.string()),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  roomId: v.optional(v.id("rooms")),
  roomCode: v.optional(v.string()),
  teacherName: v.optional(v.string()),
  notes: v.optional(v.string()),
  rawCellText: v.optional(v.string()),
  active: v.boolean(),
};

export const assessmentSeedEntryValidator = v.object(assessmentSeedEntryFields);

export const substitutionCandidateFields = {
  staffId: v.id("staff"),
  score: v.number(),
  eligible: v.boolean(),
  reasons: v.array(v.string()),
};

export const substitutionCandidateValidator = v.object(
  substitutionCandidateFields,
);

export const ragChunkFields = {
  chunkIndex: v.number(),
  text: v.string(),
  embedding: v.array(v.float64()),
  sectionRef: v.optional(v.string()),
};

export const ragChunkValidator = v.object(ragChunkFields);

export const taskDraftFields = {
  source: taskSourceValidator,
  title: v.string(),
  description: v.string(),
  assigneeStaffId: v.id("staff"),
  creatorStaffId: v.id("staff"),
  dueAt: v.optional(v.string()),
  priority: taskPriorityValidator,
  relatedIncidentId: v.optional(v.id("incidents")),
  relatedCommandId: v.optional(v.id("voiceCommands")),
  complianceCheckId: v.optional(v.id("complianceChecks")),
};

export const taskDraftValidator = v.object(taskDraftFields);

export type AttendanceExtraction = {
  kind: "attendance";
  classCode: string;
  presentCount: number;
  absentCount: number;
  confidence: number;
  lateCount?: number;
};

export type IncidentSeverity = "low" | "medium" | "high";

export type IncidentExtraction = {
  kind: "incident";
  title: string;
  description: string;
  category?: string;
  location?: string;
  severity?: IncidentSeverity;
  confidence?: number;
};

export type IgnoreExtraction = {
  kind: "ignore";
  reason?: string;
  confidence?: number;
};

export type TeacherExtraction =
  | AttendanceExtraction
  | IncidentExtraction
  | IgnoreExtraction;

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: string[] };

export function normalizeTeacherExtraction(
  input: TeacherExtraction | Record<string, unknown>,
): TeacherExtraction {
  const record = input as Record<string, unknown>;

  if (input.kind === "incident") {
    return {
      kind: "incident",
      title: String(record.title ?? "Untitled incident"),
      description: String(record.description ?? ""),
      category: String(record.category ?? "facilities"),
      location:
        record.location === undefined ? undefined : String(record.location),
      severity: (record.severity as IncidentSeverity | undefined) ?? "medium",
      confidence:
        record.confidence === undefined ? 0.75 : Number(record.confidence),
    };
  }

  if (input.kind === "attendance") {
    return {
      kind: "attendance",
      classCode: String(record.classCode ?? ""),
      presentCount: Number(record.presentCount ?? 0),
      absentCount: Number(record.absentCount ?? 0),
      lateCount:
        record.lateCount === undefined ? undefined : Number(record.lateCount),
      confidence: Number(record.confidence ?? 0),
    };
  }

  return {
    kind: "ignore",
    reason: record.reason === undefined ? undefined : String(record.reason),
    confidence:
      record.confidence === undefined ? undefined : Number(record.confidence),
  };
}

export function validateTeacherExtraction(
  input: TeacherExtraction | Record<string, unknown>,
): ValidationResult {
  const extraction = normalizeTeacherExtraction(input);
  const issues: string[] = [];

  if (extraction.kind === "attendance") {
    if (!extraction.classCode.trim()) {
      issues.push("Attendance extraction must include classCode");
    }
    if (extraction.presentCount < 0 || extraction.absentCount < 0) {
      issues.push("Attendance counts cannot be negative");
    }
    if (extraction.confidence < 0 || extraction.confidence > 1) {
      issues.push("Attendance confidence must be between 0 and 1");
    }
  }

  if (extraction.kind === "incident") {
    if (!extraction.title.trim()) {
      issues.push("Incident extraction must include title");
    }
    if (!extraction.description.trim()) {
      issues.push("Incident extraction must include description");
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true };
}
