# Technical Specification: Digital Vice Principal Backend

**Version:** 1.0  
**Stack:** Backend - Convex, TypeScript, OpenAI, Telegram Bot API  
**Date:** 2026-04-18  
**Repository:** `aishackchotam67`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Database Schema](#4-database-schema)
5. [Backend Modules](#5-backend-modules)
6. [Telegram Integration](#6-telegram-integration)
7. [AI and LLM Layer](#7-ai-and-llm-layer)
8. [Attendance and Meal Summary Flow](#8-attendance-and-meal-summary-flow)
9. [Incident and Task Flow](#9-incident-and-task-flow)
10. [Voice-to-Task Flow](#10-voice-to-task-flow)
11. [Smart Substitution Flow](#11-smart-substitution-flow)
12. [RAG and Compliance Flow](#12-rag-and-compliance-flow)
13. [Dashboard-Facing Queries](#13-dashboard-facing-queries)
14. [Notifications](#14-notifications)
15. [Cron Jobs](#15-cron-jobs)
16. [HTTP Endpoints](#16-http-endpoints)
17. [Environment Variables](#17-environment-variables)
18. [Testing and Quality Gates](#18-testing-and-quality-gates)
19. [Folder Structure](#19-folder-structure)
20. [Current Implementation Notes](#20-current-implementation-notes)

---

## 1. Project Overview

This project implements the Convex backend for a digital vice-principal / school operations orchestrator. The backend converts operational school communication into structured records for attendance, meal summaries, incidents, tasks, substitutions, compliance checks, and Telegram notifications.

The current repository is backend-focused. It does not contain a React/Vite frontend. Dashboard support is provided through Convex queries and mutations that an external frontend can consume.

Primary operating surfaces:

- **Telegram bot webhook** for teacher messages and notification delivery.
- **Dashboard-facing Convex functions** for overview, review queues, schedules, tasks, substitutions, compliance, and document status.
- **AI pipelines** for teacher message parsing, director voice command routing, document embeddings, compliance reasoning, and voice transcription.
- **Convex storage and vector search** for ministry document ingestion and RAG retrieval.

Core goals:

- Extract attendance and incident information from free-form teacher messages.
- Generate daily meal summaries after a school-local cutoff.
- Convert director voice commands into assigned tasks.
- Rank substitution candidates when a teacher is absent.
- Check operational text against uploaded policy documents.
- Send Telegram notifications to staff.

---

## 2. System Architecture

```text
Telegram
  |
  | POST /telegram/webhook?schoolId=...
  v
Convex HTTP Action
  |
  | stores telegramMessages
  | schedules processInbound
  v
Convex Actions and Mutations
  |
  | AI extraction / task routing / notifications / RAG
  v
Convex Database + Storage + Vector Search
  |
  | real-time queries exposed to dashboard clients
  v
Dashboard or admin client

External services:
  - OpenAI Responses API for JSON/text reasoning
  - OpenAI Audio Transcriptions API for voice commands
  - OpenAI Embeddings API for RAG chunks
  - Telegram Bot API for outbound messages
```

Data flow is event-driven. Public mutations store user input, actions perform slow external work, and scheduled jobs move work through queues. Convex tables are the source of truth for all operational state.

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend platform | Convex `^1.17.4` | Database, server functions, HTTP actions, cron jobs, storage, vector search |
| Language | TypeScript `^5.9.3` | Backend and test implementation |
| AI SDK | OpenAI `^5.12.2` | Reasoning, embeddings, transcription |
| Document parsing | `pdf-parse` `^1.1.1` | PDF text extraction for RAG indexing |
| Tests | Vitest `^3.2.4` | Unit tests for config, validators, time, AI extraction, ranking |
| Runtime config | Convex environment variables | AI model selection and Telegram credentials |

Package scripts:

```bash
npm test
npm run typecheck
```

---

## 4. Database Schema

All application tables are defined in `convex/schema.ts`.

### 4.1 School Core

#### `schools`

Stores tenant-level school configuration.

| Field | Type | Notes |
|---|---|---|
| `name` | string | School display name |
| `timezone` | string | IANA timezone used for cutoffs and school-local dates |
| `locale` | string | Locale identifier |
| `active` | boolean | Enables or disables a school record |

#### `staff`

Stores staff identities and operational role metadata.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `fullName` | string | Full legal/display name |
| `displayName` | string | Short name used for matching and UI |
| `roles` | array | `director`, `vice_principal`, `teacher`, `admin`, `facilities`, `kitchen` |
| `subjects` | string[] | Teaching subjects or support areas |
| `grades` | string[] | Grade familiarity |
| `qualifications` | string[] | Extra qualifications used in substitution scoring |
| `telegramEnabled` | boolean | Whether Telegram can be used |
| `dashboardAccess` | boolean | Whether dashboard access is allowed |
| `isActive` | boolean | Assignment eligibility |

Indexes:

- `by_school_name`: `schoolId`, `fullName`
- `by_school_role_active`: `schoolId`, `isActive`

#### `classes`

Stores class groups.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `code` | string | Human code such as `1A` |
| `grade` | string | Grade level |
| `homeroomTeacherId` | optional `Id<"staff">` | Homeroom teacher |
| `active` | boolean | Used by attendance summary generation |

Index:

- `by_school_code`: `schoolId`, `code`

#### `rooms`

Stores physical rooms.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `code` | string | Room code |
| `capacity` | optional number | Seating capacity |
| `active` | boolean | Whether the room can be scheduled |

Index:

- `by_school_code`: `schoolId`, `code`

#### `timeSlots`

Stores lesson start/end times.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `weekday` | number | Weekday number |
| `lessonNumber` | number | Lesson slot |
| `startTime` | string | Local time |
| `endTime` | string | Local time |

Index:

- `by_school_weekday_lesson`: `schoolId`, `weekday`, `lessonNumber`

#### `scheduleTemplates`

Stores the recurring base schedule.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `classId` | `Id<"classes">` | Scheduled class |
| `weekday` | number | Weekday |
| `lessonNumber` | number | Lesson slot |
| `subject` | string | Subject name |
| `teacherId` | `Id<"staff">` | Base teacher |
| `roomId` | `Id<"rooms">` | Base room |

Indexes:

- `by_class_weekday_lesson`: `classId`, `weekday`, `lessonNumber`
- `by_teacher_weekday_lesson`: `teacherId`, `weekday`, `lessonNumber`
- `by_room_weekday_lesson`: `roomId`, `weekday`, `lessonNumber`

#### `scheduleOverrides`

Stores applied or proposed daily substitutions.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `date` | string | ISO date |
| `classId` | `Id<"classes">` | Affected class |
| `lessonNumber` | number | Affected lesson |
| `subject` | string | Subject from base row |
| `originalTeacherId` | `Id<"staff">` | Absent/base teacher |
| `substituteTeacherId` | `Id<"staff">` | Chosen substitute |
| `roomId` | `Id<"rooms">` | Room used by override |
| `reason` | string | Absence or operational reason |
| `requestId` | `Id<"substitutionRequests">` | Source substitution request |
| `status` | string | `proposed`, `confirmed`, `applied`, `canceled` |

Indexes:

- `by_school_date_class_lesson`: `schoolId`, `date`, `classId`, `lessonNumber`
- `by_school_date_teacher_lesson`: `schoolId`, `date`, `substituteTeacherId`, `lessonNumber`
- `by_request`: `requestId`

### 4.2 Telegram and Operations

#### `telegramAccounts`

Maps Telegram users to staff members.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `staffId` | `Id<"staff">` | Linked staff member |
| `telegramUserId` | string | Telegram sender id |
| `username` | optional string | Telegram username |
| `chatId` | string | Private chat id for outbound messages |
| `kind` | string | `teacher`, `director`, or `admin` |
| `active` | boolean | Whether account can receive/send |

Indexes:

- `by_school_telegram_user`: `schoolId`, `telegramUserId`
- `by_school_staff`: `schoolId`, `staffId`

#### `telegramMessages`

Stores inbound and outbound Telegram message records.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `chatId` | string | Telegram chat id |
| `telegramMessageId` | string | Telegram message id |
| `telegramUserId` | string | Sender id |
| `staffId` | optional `Id<"staff">` | Linked staff account, if known |
| `direction` | string | `in` or `out` |
| `messageType` | string | `text` or `voice` |
| `rawText` | optional string | Message text or caption |
| `fileId` | optional string | Telegram voice file id |
| `receivedAt` | string | ISO timestamp |
| `parserStatus` | string | `pending`, `processed`, `ignored`, `error` |
| `dedupeKey` | string | Prevents duplicate webhook processing |

Indexes:

- `by_dedupe_key`: `dedupeKey`
- `by_school_status_receivedAt`: `schoolId`, `parserStatus`, `receivedAt`
- `by_chat_message`: `chatId`, `telegramMessageId`

#### `attendanceFacts`

Stores parsed daily attendance facts by class.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `date` | string | School-local ISO date |
| `classId` | `Id<"classes">` | Class |
| `sourceMessageId` | `Id<"telegramMessages">` | Source Telegram message |
| `presentCount` | number | Present students |
| `absentCount` | number | Absent students |
| `mealCount` | number | Meal portions, currently equal to `presentCount` |
| `confidence` | number | AI extraction confidence |
| `parserRunId` | optional `Id<"aiRuns">` | Optional AI run link |

Indexes:

- `by_school_date_class`: `schoolId`, `date`, `classId`
- `by_school_date`: `schoolId`, `date`

#### `mealSummaries`

Stores generated school-level meal summaries.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `date` | string | School-local ISO date |
| `cutoffAt` | string | Generation timestamp |
| `totalMeals` | number | Sum of meal counts |
| `totalAbsent` | number | Sum of absent students |
| `missingClasses` | string[] | Active class codes without submitted attendance |
| `sentToKitchenAt` | optional string | Reserved for kitchen dispatch |
| `generatedByRunId` | optional `Id<"aiRuns">` | Optional AI run link |

Index:

- `by_school_date`: `schoolId`, `date`

#### `incidents`

Stores incidents parsed from Telegram teacher messages.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `sourceMessageId` | `Id<"telegramMessages">` | Source message |
| `reportedByStaffId` | `Id<"staff">` | Reporter |
| `category` | string | Example: `facilities` |
| `title` | string | Short incident title |
| `description` | string | Full description |
| `location` | optional string | Room or location |
| `severity` | string | `low`, `medium`, `high` |
| `status` | string | `open`, `in_progress`, `resolved` |
| `linkedTaskId` | optional `Id<"tasks">` | Auto-created follow-up task |

Index:

- `by_school_status_created`: `schoolId`, `status`

#### `voiceCommands`

Stores director dashboard voice command uploads.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `createdByStaffId` | `Id<"staff">` | Director or staff creator |
| `source` | literal | Currently `dashboard` |
| `audioStorageId` | optional `Id<"_storage">` | Uploaded audio blob |
| `transcript` | optional string | Transcription output |
| `normalizedCommand` | optional string | JSON routing result |
| `status` | string | `uploaded`, `transcribed`, `routed`, `error` |
| `parserRunId` | optional `Id<"aiRuns">` | Optional AI run link |

Index:

- `by_school_status_created`: `schoolId`, `status`

#### `tasks`

Stores structured assignments from incidents, voice commands, manual entries, or compliance checks.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `source` | string | `incident`, `voice`, `manual`, `compliance` |
| `title` | string | Task title |
| `description` | string | Task details |
| `assigneeStaffId` | `Id<"staff">` | Assignee |
| `creatorStaffId` | `Id<"staff">` | Creator |
| `dueAt` | optional string | Due date/time text |
| `priority` | string | `low`, `medium`, `high` |
| `status` | string | `todo`, `in_progress`, `done`, `canceled` |
| `relatedIncidentId` | optional `Id<"incidents">` | Incident link |
| `relatedCommandId` | optional `Id<"voiceCommands">` | Voice command link |
| `complianceCheckId` | optional `Id<"complianceChecks">` | Compliance link |

Indexes:

- `by_school_assignee_status_due`: `schoolId`, `assigneeStaffId`, `status`, `dueAt`
- `by_school_source_status`: `schoolId`, `source`, `status`
- `by_related_incident`: `relatedIncidentId`

### 4.3 Substitutions

#### `substitutionRequests`

Stores requests to replace an absent teacher for one or more lessons.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `absentTeacherId` | `Id<"staff">` | Absent teacher |
| `date` | string | ISO date |
| `lessons` | number[] | Lesson numbers |
| `reason` | string | Absence reason |
| `createdByStaffId` | `Id<"staff">` | Request creator |
| `sourceCommandId` | optional `Id<"voiceCommands">` | Optional voice command source |
| `status` | string | `pending`, `ranked`, `confirmed`, `applied`, `error` |
| `chosenCandidates` | array | Ranked candidate snapshots |

Indexes:

- `by_school_date_status`: `schoolId`, `date`, `status`
- `by_absentTeacher_date`: `absentTeacherId`, `date`

### 4.4 RAG and Compliance

#### `ministryDocuments`

Stores uploaded ministry or policy documents.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `code` | string | Document code |
| `title` | string | Document title |
| `storageId` | `Id<"_storage">` | Convex storage file id |
| `language` | string | Document language |
| `version` | string | Version label |
| `uploadedAt` | string | ISO timestamp |
| `parseStatus` | string | `uploaded`, `parsed`, `embedded`, `error` |

Index:

- `by_school_code_version`: `schoolId`, `code`, `version`

#### `ministryChunks`

Stores chunk text and vector embeddings.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `documentId` | `Id<"ministryDocuments">` | Source document |
| `chunkIndex` | number | Sequential chunk index |
| `text` | string | Chunk text |
| `embedding` | number[] | Embedding vector |
| `sectionRef` | optional string | Optional section reference |
| `language` | string | Chunk language |

Indexes:

- `by_document_chunkIndex`: `documentId`, `chunkIndex`
- Vector index `by_embedding` on `embedding`, dimensions `3072`, filters `schoolId`, `documentId`, `language`

#### `complianceChecks`

Stores compliance reasoning results.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `targetType` | string | `task`, `schedule_override`, `freeform` |
| `targetId` | optional string | Target record id |
| `inputText` | string | Text checked against policy context |
| `result` | string | `pass`, `warn`, `fail` |
| `findings` | string[] | Compliance findings |
| `citations` | string[] | Source references |
| `rewriteText` | optional string | Plain-language rewrite |
| `checkedAt` | string | ISO timestamp |

Indexes:

- `by_school_target`: `schoolId`, `targetType`, `targetId`
- `by_school_result_checkedAt`: `schoolId`, `result`, `checkedAt`

### 4.5 Notifications, AI Runs, and Audit

#### `notifications`

Stores outbound Telegram notification jobs.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `channel` | literal | Currently `telegram` |
| `recipientStaffId` | `Id<"staff">` | Recipient |
| `templateKey` | string | Notification template identifier |
| `payload` | any | Payload, usually `{ text }` |
| `status` | string | `queued`, `sending`, `sent`, `error` |
| `externalMessageId` | optional string | Telegram message id |
| `scheduledFor` | string | ISO timestamp |
| `sentAt` | optional string | Sent timestamp |
| `dedupeKey` | string | Prevents duplicate notification rows |

Indexes:

- `by_school_status_scheduledFor`: `schoolId`, `status`, `scheduledFor`
- `by_recipient_status`: `recipientStaffId`, `status`

#### `aiRuns`

Stores AI run metadata for observability and stale-run cleanup.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `capability` | string | AI capability key |
| `provider` | string | Example: `openai` |
| `model` | string | Configured model |
| `sourceTable` | string | Source table name |
| `sourceId` | string | Source row id |
| `status` | string | `started`, `completed`, `error` |
| `inputHash` | string | Input hash |
| `outputJson` | optional any | Structured output |
| `outputText` | optional string | Text output |
| `error` | optional string | Error text |
| `startedAt` | string | Start timestamp |
| `finishedAt` | optional string | Finish timestamp |
| `latencyMs` | optional number | Runtime |

Indexes:

- `by_source`: `sourceTable`, `sourceId`
- `by_status_startedAt`: `status`, `startedAt`

#### `auditEvents`

Stores generic audit events.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `Id<"schools">` | Parent school |
| `actorStaffId` | optional `Id<"staff">` | Actor |
| `eventType` | string | Event key |
| `entityType` | string | Entity type |
| `entityId` | string | Entity id |
| `metadata` | any | Event details |
| `createdAt` | string | ISO timestamp |

Index:

- `by_school_event`: `schoolId`, `eventType`

---

## 5. Backend Modules

### 5.1 School Core

| File | Public functions | Purpose |
|---|---|---|
| `convex/modules/schoolCore/schools.ts` | `ensureSchool`, `list` | Create or list schools |
| `convex/modules/schoolCore/staff.ts` | `seed`, `listAssignable` | Seed staff and list active assignable staff |
| `convex/modules/schoolCore/classes.ts` | `upsertMany`, `listActive` | Seed/update classes and list active classes |
| `convex/modules/schoolCore/rooms.ts` | `upsertMany`, `listActive` | Seed/update rooms and list active rooms |
| `convex/modules/schoolCore/schedule.ts` | `seed`, `getToday`, `getClassDay` | Seed schedule templates and resolve daily schedule with overrides |

### 5.2 Operations

| File | Public functions | Purpose |
|---|---|---|
| `convex/modules/ops/telegram.ts` | `storeInbound`, `processInbound`, `sendMessage` | Store Telegram updates, parse teacher messages, dispatch Telegram send requests |
| `convex/modules/ops/attendance.ts` | `upsertFact`, `save`, `listByDate`, `getMealSummary` | Store attendance facts and meal summaries |
| `convex/modules/ops/incidents.ts` | `createFromParse`, `updateStatus`, `listOpen` | Manage incident records |
| `convex/modules/ops/tasks.ts` | `createBatch`, `updateStatus`, `listBoard` | Manage operational tasks |
| `convex/modules/ops/voice.ts` | `createDashboardUpload`, `submitDashboardAudio`, `transcribeAudio`, `routeDirectorCommand` | Upload, transcribe, and route director voice commands |
| `convex/modules/ops/notifications.ts` | `enqueue`, `markSent`, `listRecent`, `sendTelegram` | Queue and send Telegram notifications |
| `convex/modules/ops/aiRuns.ts` | internal `start`, `finish`, `listStuck` | Track AI run lifecycle |

### 5.3 Substitutions

| File | Public functions | Purpose |
|---|---|---|
| `convex/modules/substitutions/requests.ts` | `createRequest`, `listToday`, `getRequest`, `confirmOverride` | Create and confirm substitution requests |
| `convex/modules/substitutions/planner.ts` | `rankCandidates` | Rank available substitute teachers |
| `convex/modules/substitutions/overrides.ts` | `applyOverride` | Apply confirmed substitution rows to the schedule |

### 5.4 RAG and Compliance

| File | Public functions | Purpose |
|---|---|---|
| `convex/modules/rag/documents.ts` | `registerUpload`, `getDocumentStatus` | Register uploaded documents and schedule indexing |
| `convex/modules/rag/documentExtraction.ts` | internal `extractDocumentText` | Extract PDF/text content, chunk, embed, and save chunks |
| `convex/modules/rag/chunks.ts` | `chunkText`, `saveChunks` | Chunk text and persist vector chunks |
| `convex/modules/rag/retrieval.ts` | `retrieveContext` | Embed queries and run vector search |
| `convex/modules/rag/compliance.ts` | `saveResult`, `listRecent`, `checkTarget`, `rewritePlainLanguage` | Run compliance reasoning and plain-language rewrites |

### 5.5 Dashboard

| File | Public functions | Purpose |
|---|---|---|
| `convex/modules/dashboard/overview.ts` | `getOverview` | Aggregate current operational counts for a school |
| `convex/modules/dashboard/queues.ts` | `listReviewQueues` | List pending messages and substitution review queues |

### 5.6 Seeds

| File | Public functions | Purpose |
|---|---|---|
| `convex/seeds/staff.ts` | `seedStaffBundle` | Wrapper for staff seeding |
| `convex/seeds/schedule.ts` | `seedScheduleBundle` | Wrapper for schedule seeding |
| `convex/seeds/orders.ts` | `registerOrderBundle` | Wrapper for RAG document registration |

---

## 6. Telegram Integration

Telegram inbound messages arrive through `convex/http.ts`.

### Inbound webhook

```text
POST /telegram/webhook?schoolId=<schools id>
```

Processing steps:

1. Validate that `schoolId` is present.
2. Parse Telegram update payload.
3. Ignore non-message events and non-private chats.
4. Extract text, caption, or voice file id.
5. Store the message through `modules/ops/telegram:storeInbound`.
6. Schedule `modules/ops/telegram:processInbound`.
7. Return `{ ok: true }` to Telegram.

The dedupe key is `${chat.id}:${message.message_id}`.

### Message parsing

`processInbound` reads the stored message, loads the school timezone, and calls `runTeacherMessageExtraction`.

Supported extraction kinds:

- `attendance`
- `incident`
- `ignore`

Attendance messages upsert `attendanceFacts`. Incident messages create an `incidents` row, optionally create a facilities task, enqueue a Telegram notification, and link the incident to the task.

### Outbound Telegram

Outbound messages are sent through `modules/ops/notifications:sendTelegram`, which:

1. Loads the notification row.
2. Finds the recipient's active Telegram account.
3. Reads `TELEGRAM_BOT_TOKEN`.
4. Sends `sendMessage` through the Telegram Bot API.
5. Marks the notification as `sent` with the external Telegram message id.

---

## 7. AI and LLM Layer

AI capability configuration lives in `convex/lib/ai/config.ts`.

Supported capabilities:

| Capability | Purpose |
|---|---|
| `teacherMessageExtraction` | Classify and extract attendance or incident data from teacher messages |
| `voiceTranscription` | Transcribe dashboard audio uploads |
| `directorCommandRouting` | Split director transcripts into structured tasks |
| `complianceReasoning` | Check operational text against retrieved policy context |
| `documentEmbeddings` | Embed document chunks and retrieval queries |

The provider defaults to `openai`. Each capability can override provider, model, and prompt profile via environment variables.

### Reasoning APIs

`convex/lib/ai/reasoning.ts` exposes:

- `runTextReasoning`: returns provider, model, and output text.
- `runJsonReasoning<T>`: parses output text as JSON and returns typed JSON.

### Prompt builders

`convex/lib/prompts.ts` defines prompts for:

- Teacher message extraction.
- Director command routing.
- Compliance checks.
- Plain-language policy rewrites.

### Teacher extraction validator

`convex/lib/validators.ts` normalizes and validates AI extraction output. Attendance extraction requires a non-empty class code, non-negative counts, and confidence between `0` and `1`. Incident extraction requires title and description.

---

## 8. Attendance and Meal Summary Flow

### Attendance ingestion

```text
Teacher Telegram message
  -> /telegram/webhook
  -> telegramMessages row
  -> processInbound action
  -> OpenAI teacherMessageExtraction
  -> attendanceFacts upsert by school/date/class
```

An attendance fact includes present count, absent count, meal count, confidence, source message id, and school-local date.

### Meal summary generation

`modules/ops/attendance:generateDueMealSummaries` is an internal action called by cron every five minutes.

For each school:

1. Check whether local school time has passed `09:00`.
2. Skip if the meal summary for the current school-local date already exists.
3. Load attendance facts for that date.
4. Load active classes.
5. Compute missing class codes.
6. Store a `mealSummaries` row with totals.

The summary currently computes:

- `totalMeals` as the sum of `mealCount`.
- `totalAbsent` as the sum of `absentCount`.
- `missingClasses` from active classes without facts.

---

## 9. Incident and Task Flow

Teacher incident messages follow this path:

```text
Telegram text
  -> teacherMessageExtraction returns kind=incident
  -> incidents.createFromParse
  -> find facilities assignee
  -> tasks.createBatch
  -> notifications.enqueue
  -> incident linked to created task
```

Incident defaults:

- `status`: `open`
- `category`: extracted category or `facilities`
- `severity`: extracted severity or `medium`
- Task priority: `high` only when severity is `high`; otherwise `medium`

Task status transitions:

```text
todo -> in_progress -> done
todo -> canceled
```

Incident status transitions:

```text
open -> in_progress -> resolved
```

---

## 10. Voice-to-Task Flow

Dashboard voice commands are handled in `convex/modules/ops/voice.ts`.

```text
Dashboard requests upload URL
  -> createDashboardUpload
  -> client uploads audio to Convex storage
  -> submitDashboardAudio
  -> transcribeAudio action
  -> OpenAI transcription
  -> routeDirectorCommand action
  -> OpenAI structured task routing
  -> tasks.createBatch
  -> notifications.enqueue per task
```

The director routing prompt expects JSON:

```json
{
  "tasks": [
    {
      "title": "Prepare assembly hall",
      "description": "Prepare assembly hall for next week's event",
      "assigneeName": "Aigerim",
      "dueText": "next week",
      "priority": "medium"
    }
  ]
}
```

Assignees are matched by exact case-insensitive `displayName` or `fullName` against active assignable staff.

---

## 11. Smart Substitution Flow

Substitution requests are created through `modules/substitutions/requests:createRequest`.

```text
createRequest
  -> inserts substitutionRequests row with status=pending
  -> schedules planner.rankCandidates
  -> planner loads absent teacher, lesson, schedule, staff, overrides
  -> rankSubstitutionCandidates
  -> saves top 5 candidates and marks request ranked
  -> confirmOverride
  -> applyOverride
  -> inserts scheduleOverrides and marks request applied
```

Candidate scoring is implemented in `convex/lib/ranking.ts`.

Scoring rules:

| Signal | Effect |
|---|---|
| Candidate is free | `+40` |
| Room is available | `+10` |
| Subject match | `+30` |
| Grade match | `+20` |
| Has explicit qualifications | `+10` |
| Daily assigned lessons | `-3` per lesson |

A candidate is eligible only when `isFree` and `roomAvailable` are both true.

Current implementation ranks candidates for the first requested lesson when building the context. It still checks conflicts across all requested lessons when calculating candidate availability.

---

## 12. RAG and Compliance Flow

### Document ingestion

```text
registerUpload
  -> ministryDocuments row with parseStatus=uploaded
  -> schedules extractDocumentText
  -> reads Convex storage blob
  -> pdf-parse for PDFs or Blob.text for text-like files
  -> chunkText(max 1200 chars)
  -> embedText per chunk
  -> saveChunks replaces existing chunks
  -> document parseStatus=embedded
```

`extractDocumentText` runs in the Node.js Convex runtime because it uses `pdf-parse`.

### Retrieval

`modules/rag/retrieval:retrieveContext`:

1. Embeds the query text.
2. Runs Convex vector search over `ministryChunks.by_embedding`.
3. Loads matching chunks by id.
4. Returns chunks with vector search scores.

### Compliance check

```text
checkTarget(inputText)
  -> retrieveContext
  -> buildCompliancePrompt
  -> OpenAI JSON reasoning
  -> saveResult
  -> return result, findings, citations, rewriteText
```

Compliance results are stored as `pass`, `warn`, or `fail`.

### Plain-language rewrite

`rewritePlainLanguage` retrieves context and asks the model to rewrite source policy text into a teacher checklist while preserving meaning.

---

## 13. Dashboard-Facing Queries

### `modules/dashboard/overview:getOverview`

Returns:

- `schoolDate`
- `openIncidentCount`
- `taskCounts.todo`
- `taskCounts.inProgress`
- `taskCounts.done`
- `substitutionCount`
- `mealSummary`
- `recentNotifications`

The query resolves the school-local date using the configured school timezone.

### `modules/dashboard/queues:listReviewQueues`

Returns:

- Pending Telegram messages.
- Substitution requests with `ranked` or `pending` status.

### Additional dashboard-ready functions

| Area | Functions |
|---|---|
| Attendance | `listByDate`, `getMealSummary` |
| Incidents | `listOpen`, `updateStatus` |
| Tasks | `listBoard`, `updateStatus` |
| Substitutions | `listToday`, `getRequest`, `confirmOverride` |
| Schedule | `getToday`, `getClassDay` |
| RAG | `getDocumentStatus`, `listRecent`, `checkTarget`, `rewritePlainLanguage` |
| Notifications | `listRecent` |

---

## 14. Notifications

Notifications are Telegram-only in the current schema.

Queue lifecycle:

```text
queued -> sending -> sent
queued -> sending -> error
```

Creation:

- `notifications.enqueue` inserts a row unless the `dedupeKey` already exists.

Dispatch:

- `notifications.dispatchDue` loads due queued notifications and schedules `sendTelegram`.

Delivery:

- `notifications.sendTelegram` sends text using the Telegram Bot API and marks the row `sent`.

Templates currently store arbitrary payloads. When `payload.text` is present, it is sent directly; otherwise the payload is JSON-stringified.

---

## 15. Cron Jobs

Cron jobs are defined in `convex/crons.ts`.

| Job | Schedule | Function |
|---|---|---|
| Generate due meal summaries | Every 5 minutes | `modules/ops/attendance:generateDueMealSummaries` |
| Dispatch due notifications | Every 10 minutes | `modules/ops/notifications:dispatchDue` |
| Retry stuck AI runs | Every 15 minutes | `ops:retryStuckAiRuns` |
| Reindex pending documents | Daily at `01:00` | `modules/rag/documents:reindexPendingDocuments` |
| Cleanup expired audio | Daily at `01:30` | `ops:cleanupExpiredAudio` |
| Build director digest | Daily at `02:00` | `modules/dashboard/queues:buildDirectorDigest` |

The cleanup job deletes stored voice audio blobs for voice commands that still have `audioStorageId` and clears the reference.

The stuck AI run job marks runs older than 15 minutes as `error`.

---

## 16. HTTP Endpoints

External HTTP endpoints are registered in `convex/http.ts`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/telegram/health` | Returns `{ ok: true }` |
| `POST` | `/telegram/webhook?schoolId=<id>` | Receives Telegram private chat messages and schedules parsing |

All other application access is through generated Convex function references.

---

## 17. Environment Variables

### Required

| Variable | Used by | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | AI reasoning, embeddings, transcription | Authenticates OpenAI SDK calls |
| `TELEGRAM_BOT_TOKEN` | Telegram notification send | Authenticates Telegram Bot API calls |

### AI defaults

| Variable | Purpose |
|---|---|
| `AI_DEFAULT_PROVIDER` | Defaults to `openai` when unset |
| `AI_DEFAULT_MODEL` | Fallback model for all capabilities when capability-specific model is unset |
| `AI_DEFAULT_PROMPT_PROFILE` | Defaults to `default` when unset |

### Capability-specific overrides

Each capability supports:

```text
<PREFIX>_PROVIDER
<PREFIX>_MODEL
<PREFIX>_PROMPT_PROFILE
```

Prefixes:

| Capability | Prefix |
|---|---|
| `teacherMessageExtraction` | `AI_TEACHER_MESSAGE_EXTRACTION` |
| `voiceTranscription` | `AI_VOICE_TRANSCRIPTION` |
| `directorCommandRouting` | `AI_DIRECTOR_COMMAND_ROUTING` |
| `complianceReasoning` | `AI_COMPLIANCE_REASONING` |
| `documentEmbeddings` | `AI_DOCUMENT_EMBEDDINGS` |

Example:

```bash
npx convex env set OPENAI_API_KEY sk-...
npx convex env set TELEGRAM_BOT_TOKEN 123456:token
npx convex env set AI_DEFAULT_MODEL gpt-4.1-mini
npx convex env set AI_DOCUMENT_EMBEDDINGS_MODEL text-embedding-3-large
npx convex env set AI_VOICE_TRANSCRIPTION_MODEL gpt-4o-mini-transcribe
```

The vector index is configured for `3072` dimensions, so the configured embedding model must return vectors with that dimensionality.

---

## 18. Testing and Quality Gates

Tests are configured in `vitest.config.ts` with Node environment and include `tests/**/*.test.ts`.

Existing tests cover:

| Test file | Coverage |
|---|---|
| `tests/ai-config.test.ts` | AI capability configuration and required model behavior |
| `tests/ai-extraction.test.ts` | Teacher extraction validation failure handling |
| `tests/ranking.test.ts` | Substitution ranking preference and workload penalty |
| `tests/time.test.ts` | School timezone date/cutoff helpers |
| `tests/validators.test.ts` | Teacher extraction normalization and validation |

Recommended verification commands:

```bash
npm test
npm run typecheck
```

---

## 19. Folder Structure

```text
aishackchotam67/
  AGENTS.md
  README.md
  TECHNICAL_SPECIFICATION.md
  package.json
  tsconfig.json
  vitest.config.ts
  requirements_pdf_extracted.txt
  convex/
    schema.ts
    http.ts
    crons.ts
    ops.ts
    lib/
      env.ts
      functionRefs.ts
      prompts.ts
      ranking.ts
      time.ts
      validators.ts
      ai/
        config.ts
        embeddings.ts
        extraction.ts
        reasoning.ts
        transcription.ts
      integrations/
        telegram.ts
    modules/
      dashboard/
        overview.ts
        queues.ts
      ops/
        aiRuns.ts
        attendance.ts
        incidents.ts
        notifications.ts
        tasks.ts
        telegram.ts
        voice.ts
      rag/
        chunks.ts
        compliance.ts
        documentExtraction.ts
        documents.ts
        retrieval.ts
      schoolCore/
        classes.ts
        rooms.ts
        schedule.ts
        schools.ts
        staff.ts
      substitutions/
        overrides.ts
        planner.ts
        requests.ts
    seeds/
      orders.ts
      schedule.ts
      staff.ts
  tests/
    ai-config.test.ts
    ai-extraction.test.ts
    ranking.test.ts
    time.test.ts
    validators.test.ts
  types/
    pdf-parse.d.ts
```

---

## 20. Current Implementation Notes

The project currently implements the backend foundation and operational automation logic. The following points are important for planning the next development stage:

1. **Frontend is not included in this repository.** Dashboard functionality is exposed through Convex functions, but no React/Vite UI exists in the checked-in code.
2. **Authentication is not configured.** There is no `convex/auth.config.ts`; public functions currently accept ids such as `schoolId` and `staffId` directly.
3. **Telegram webhook does not validate a secret token.** The endpoint requires `schoolId` but does not currently verify Telegram or a shared webhook secret.
4. **RAG supports PDFs and text-like blobs.** DOCX parsing is not implemented.
5. **Vector index dimensions are fixed at `3072`.** Embedding model selection must stay compatible with that dimension.
6. **Notification channel is Telegram-only.** In-app notification storage is not modeled separately.
7. **Audit table exists but is not broadly written by mutations yet.**
8. **AI run tracking exists but most AI calls currently do not create `aiRuns` records.**
9. **Substitution ranking uses the first requested lesson for context.** Candidate availability checks all requested lessons, but subject/grade context comes from the first lesson row.
10. **Some queries use bounded `take` while others collect filtered data.** For larger production datasets, high-volume paths should be revisited for stricter indexing and pagination.
11. **Incident parsing assumes a linked Telegram staff account.** `incidents.createFromParse` requires `reportedByStaffId`, so unlinked Telegram users can be stored but cannot create incident records without additional handling.

---

*End of Technical Specification - Digital Vice Principal Backend v1.0*
