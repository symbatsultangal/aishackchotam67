import { cronJobs } from "convex/server";

import { internalRef } from "./lib/functionRefs";

const crons = cronJobs();

const generateDueMealSummariesRef = internalRef<"action", Record<string, never>, number>(
  "modules/ops/attendance:generateDueMealSummaries",
);
const dispatchDueNotificationsRef = internalRef<"action", Record<string, never>, number>(
  "modules/ops/notifications:dispatchDue",
);
const retryStuckAiRunsRef = internalRef<"action", Record<string, never>, number>(
  "ops:retryStuckAiRuns",
);
const reindexPendingDocumentsRef = internalRef<"action", Record<string, never>, number>(
  "modules/rag/documents:reindexPendingDocuments",
);
const cleanupExpiredAudioRef = internalRef<"action", Record<string, never>, number>(
  "ops:cleanupExpiredAudio",
);
const buildDirectorDigestRef = internalRef<"action", Record<string, never>, number>(
  "modules/dashboard/queues:buildDirectorDigest",
);

crons.interval(
  "generate due meal summaries",
  { minutes: 5 },
  generateDueMealSummariesRef,
  {},
);

crons.interval(
  "dispatch due notifications",
  { minutes: 10 },
  dispatchDueNotificationsRef,
  {},
);

crons.interval(
  "retry stuck ai runs",
  { minutes: 15 },
  retryStuckAiRunsRef,
  {},
);

crons.cron(
  "reindex pending documents",
  "0 1 * * *",
  reindexPendingDocumentsRef,
  {},
);

crons.cron(
  "cleanup expired audio",
  "30 1 * * *",
  cleanupExpiredAudioRef,
  {},
);

crons.cron(
  "build director digest",
  "0 2 * * *",
  buildDirectorDigestRef,
  {},
);

export default crons;
