import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { DEFAULT_EMBEDDING_DIMENSIONS } from "./lib/env";
import {
  assessmentKindValidator,
  aiRunStatusValidator,
  assessmentSeedEntryFields,
  complianceResultValidator,
  complianceTargetTypeValidator,
  documentParseStatusValidator,
  incidentAssignmentStatusValidator,
  incidentSeverityValidator,
  incidentStatusValidator,
  notificationStatusValidator,
  ragChunkFields,
  roleListValidator,
  scheduleOverrideStatusValidator,
  scheduleCompositeSeedEntryFields,
  substitutionCandidateValidator,
  substitutionRequestStatusValidator,
  staffLoadProfileFields,
  taskPriorityValidator,
  taskSourceValidator,
  taskStatusValidator,
  telegramIngressSourceValidator,
  telegramInviteCodeStatusValidator,
  timeSlotSeedItemFields,
  telegramMessageTypeValidator,
  telegramParserStatusValidator,
  voiceCommandStatusValidator,
} from "./lib/validators";

export default defineSchema({
  schools: defineTable({
    name: v.string(),
    timezone: v.string(),
    locale: v.string(),
    active: v.boolean(),
  }),

  staff: defineTable({
    schoolId: v.id("schools"),
    fullName: v.string(),
    displayName: v.string(),
    roles: roleListValidator,
    subjects: v.array(v.string()),
    grades: v.array(v.string()),
    qualifications: v.array(v.string()),
    telegramEnabled: v.boolean(),
    dashboardAccess: v.boolean(),
    isActive: v.boolean(),
  })
    .index("by_school_name", ["schoolId", "fullName"])
    .index("by_school_role_active", ["schoolId", "isActive"]),

  classes: defineTable({
    schoolId: v.id("schools"),
    code: v.string(),
    grade: v.string(),
    homeroomTeacherId: v.optional(v.id("staff")),
    active: v.boolean(),
  }).index("by_school_code", ["schoolId", "code"]),

  rooms: defineTable({
    schoolId: v.id("schools"),
    code: v.string(),
    capacity: v.optional(v.number()),
    floor: v.optional(v.number()),
    homeClassCode: v.optional(v.string()),
    managerName: v.optional(v.string()),
    description: v.optional(v.string()),
    active: v.boolean(),
  }).index("by_school_code", ["schoolId", "code"]),

  timeSlots: defineTable({
    schoolId: v.id("schools"),
    ...timeSlotSeedItemFields,
  }).index("by_school_weekday_lesson", ["schoolId", "weekday", "lessonNumber"]),

  scheduleTemplates: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    weekday: v.number(),
    lessonNumber: v.number(),
    subject: v.string(),
    teacherId: v.id("staff"),
    roomId: v.id("rooms"),
  })
    .index("by_class_weekday_lesson", ["classId", "weekday", "lessonNumber"])
    .index("by_teacher_weekday_lesson", ["teacherId", "weekday", "lessonNumber"])
    .index("by_room_weekday_lesson", ["roomId", "weekday", "lessonNumber"]),

  scheduleCompositeEntries: defineTable({
    schoolId: v.id("schools"),
    ...scheduleCompositeSeedEntryFields,
  })
    .index("by_class_weekday_lesson", ["classId", "weekday", "lessonNumber"])
    .index("by_school_weekday_lesson", ["schoolId", "weekday", "lessonNumber"]),

  scheduleOverrides: defineTable({
    schoolId: v.id("schools"),
    date: v.string(),
    classId: v.id("classes"),
    lessonNumber: v.number(),
    subject: v.string(),
    originalTeacherId: v.id("staff"),
    substituteTeacherId: v.id("staff"),
    roomId: v.id("rooms"),
    reason: v.string(),
    requestId: v.id("substitutionRequests"),
    status: scheduleOverrideStatusValidator,
  })
    .index("by_school_date_class_lesson", ["schoolId", "date", "classId", "lessonNumber"])
    .index("by_school_date_teacher_lesson", [
      "schoolId",
      "date",
      "substituteTeacherId",
      "lessonNumber",
    ])
    .index("by_request", ["requestId"]),

  telegramAccounts: defineTable({
    schoolId: v.id("schools"),
    staffId: v.id("staff"),
    telegramUserId: v.string(),
    username: v.optional(v.string()),
    chatId: v.string(),
    kind: v.union(v.literal("teacher"), v.literal("director"), v.literal("admin")),
    active: v.boolean(),
  })
    .index("by_school_telegram_user", ["schoolId", "telegramUserId"])
    .index("by_school_staff", ["schoolId", "staffId"])
    .index("by_school_chat", ["schoolId", "chatId"]),

  telegramInviteCodes: defineTable({
    schoolId: v.id("schools"),
    staffId: v.id("staff"),
    code: v.string(),
    status: telegramInviteCodeStatusValidator,
    expiresAt: v.string(),
    redeemedAt: v.optional(v.string()),
    redeemedTelegramUserId: v.optional(v.string()),
    redeemedChatId: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_school_staff_status", ["schoolId", "staffId", "status"])
    .index("by_school_status_expiresAt", ["schoolId", "status", "expiresAt"]),

  telegramMessages: defineTable({
    schoolId: v.id("schools"),
    chatId: v.string(),
    telegramMessageId: v.string(),
    updateId: v.optional(v.number()),
    telegramUserId: v.string(),
    staffId: v.optional(v.id("staff")),
    direction: v.union(v.literal("in"), v.literal("out")),
    messageType: telegramMessageTypeValidator,
    rawText: v.optional(v.string()),
    fileId: v.optional(v.string()),
    source: v.optional(telegramIngressSourceValidator),
    receivedAt: v.string(),
    parserStatus: telegramParserStatusValidator,
    parserDetails: v.optional(v.string()),
    dedupeKey: v.string(),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_school_status_receivedAt", ["schoolId", "parserStatus", "receivedAt"])
    .index("by_chat_message", ["chatId", "telegramMessageId"]),

  attendanceFacts: defineTable({
    schoolId: v.id("schools"),
    date: v.string(),
    classId: v.id("classes"),
    sourceMessageId: v.id("telegramMessages"),
    presentCount: v.number(),
    absentCount: v.number(),
    mealCount: v.number(),
    confidence: v.number(),
    parserRunId: v.optional(v.id("aiRuns")),
  })
    .index("by_school_date_class", ["schoolId", "date", "classId"])
    .index("by_school_date", ["schoolId", "date"])
    .index("by_source_message_id", ["sourceMessageId"]),

  mealSummaries: defineTable({
    schoolId: v.id("schools"),
    date: v.string(),
    cutoffAt: v.string(),
    totalMeals: v.number(),
    totalAbsent: v.number(),
    missingClasses: v.array(v.string()),
    sentToKitchenAt: v.optional(v.string()),
    generatedByRunId: v.optional(v.id("aiRuns")),
  }).index("by_school_date", ["schoolId", "date"]),

  incidents: defineTable({
    schoolId: v.optional(v.id("schools")),
    sourceMessageId: v.optional(v.id("telegramMessages")),
    reportedByStaffId: v.optional(v.id("staff")),
    category: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    location: v.optional(v.string()),
    severity: incidentSeverityValidator,
    status: incidentStatusValidator,
    linkedTaskId: v.optional(v.id("tasks")),
    assignmentStatus: v.optional(incidentAssignmentStatusValidator),
    assignmentReason: v.optional(v.string()),
    // Deprecated legacy dashboard fields kept temporarily so existing dev data can validate.
    type: v.optional(v.string()),
    reportedBy: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    aiConfidence: v.optional(v.number()),
  })
    .index("by_school_status_created", ["schoolId", "status"])
    .index("by_source_message_id", ["sourceMessageId"]),

  voiceCommands: defineTable({
    schoolId: v.id("schools"),
    createdByStaffId: v.id("staff"),
    source: v.literal("dashboard"),
    audioStorageId: v.optional(v.id("_storage")),
    transcript: v.optional(v.string()),
    normalizedCommand: v.optional(v.string()),
    status: voiceCommandStatusValidator,
    parserRunId: v.optional(v.id("aiRuns")),
  }).index("by_school_status_created", ["schoolId", "status"]),

  tasks: defineTable({
    schoolId: v.id("schools"),
    source: taskSourceValidator,
    title: v.string(),
    description: v.string(),
    assigneeStaffId: v.id("staff"),
    creatorStaffId: v.id("staff"),
    dueAt: v.optional(v.string()),
    priority: taskPriorityValidator,
    status: taskStatusValidator,
    relatedIncidentId: v.optional(v.id("incidents")),
    relatedCommandId: v.optional(v.id("voiceCommands")),
    complianceCheckId: v.optional(v.id("complianceChecks")),
  })
    .index("by_school_assignee_status_due", ["schoolId", "assigneeStaffId", "status", "dueAt"])
    .index("by_school_source_status", ["schoolId", "source", "status"])
    .index("by_related_incident", ["relatedIncidentId"]),

  substitutionRequests: defineTable({
    schoolId: v.id("schools"),
    absentTeacherId: v.id("staff"),
    date: v.string(),
    lessons: v.array(v.number()),
    reason: v.string(),
    createdByStaffId: v.id("staff"),
    sourceCommandId: v.optional(v.id("voiceCommands")),
    status: substitutionRequestStatusValidator,
    chosenCandidates: v.array(substitutionCandidateValidator),
  })
    .index("by_school_date_status", ["schoolId", "date", "status"])
    .index("by_absentTeacher_date", ["absentTeacherId", "date"]),

  assessmentEntries: defineTable({
    schoolId: v.id("schools"),
    ...assessmentSeedEntryFields,
  })
    .index("by_school_kind_sourceRowKey", ["schoolId", "kind", "sourceRowKey"])
    .index("by_school_kind_scheduledDate", ["schoolId", "kind", "scheduledDate"])
    .index("by_school_classId_kind", ["schoolId", "classId", "kind"]),

  staffLoadProfiles: defineTable({
    schoolId: v.id("schools"),
    ...staffLoadProfileFields,
  })
    .index("by_staff_academicYear", ["staffId", "academicYear"])
    .index("by_school_academicYear", ["schoolId", "academicYear"]),

  ministryDocuments: defineTable({
    schoolId: v.id("schools"),
    code: v.string(),
    title: v.string(),
    storageId: v.id("_storage"),
    language: v.string(),
    version: v.string(),
    uploadedAt: v.string(),
    parseStatus: documentParseStatusValidator,
  }).index("by_school_code_version", ["schoolId", "code", "version"]),

  ministryChunks: defineTable({
    schoolId: v.id("schools"),
    documentId: v.id("ministryDocuments"),
    ...ragChunkFields,
    language: v.string(),
  })
    .index("by_document_chunkIndex", ["documentId", "chunkIndex"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      filterFields: ["schoolId", "documentId", "language"],
    }),

  complianceChecks: defineTable({
    schoolId: v.id("schools"),
    targetType: complianceTargetTypeValidator,
    targetId: v.optional(v.string()),
    inputText: v.string(),
    result: complianceResultValidator,
    findings: v.array(v.string()),
    citations: v.array(v.string()),
    rewriteText: v.optional(v.string()),
    checkedAt: v.string(),
  })
    .index("by_school_target", ["schoolId", "targetType", "targetId"])
    .index("by_school_result_checkedAt", ["schoolId", "result", "checkedAt"]),

  notifications: defineTable({
    schoolId: v.optional(v.id("schools")),
    channel: v.optional(v.literal("telegram")),
    recipientStaffId: v.optional(v.id("staff")),
    templateKey: v.optional(v.string()),
    payload: v.optional(v.any()),
    status: v.optional(notificationStatusValidator),
    externalMessageId: v.optional(v.string()),
    scheduledFor: v.optional(v.string()),
    sentAt: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    // Deprecated legacy dashboard notification fields kept temporarily for migration.
    userId: v.optional(v.string()),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    isRead: v.optional(v.boolean()),
    relatedId: v.optional(v.string()),
    relatedType: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_school_status_scheduledFor", ["schoolId", "status", "scheduledFor"])
    .index("by_recipient_status", ["recipientStaffId", "status"])
    .index("by_dedupe_key", ["dedupeKey"]),

  aiRuns: defineTable({
    schoolId: v.id("schools"),
    capability: v.string(),
    provider: v.string(),
    model: v.string(),
    sourceTable: v.string(),
    sourceId: v.string(),
    status: aiRunStatusValidator,
    inputHash: v.string(),
    outputJson: v.optional(v.any()),
    outputText: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.string(),
    finishedAt: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
  })
    .index("by_source", ["sourceTable", "sourceId"])
    .index("by_status_startedAt", ["status", "startedAt"]),

  auditEvents: defineTable({
    schoolId: v.id("schools"),
    actorStaffId: v.optional(v.id("staff")),
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadata: v.any(),
    createdAt: v.string(),
  }).index("by_school_event", ["schoolId", "eventType"]),
});
