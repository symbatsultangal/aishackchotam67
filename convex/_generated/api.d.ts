/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_ai_config from "../lib/ai/config.js";
import type * as lib_ai_embeddings from "../lib/ai/embeddings.js";
import type * as lib_ai_extraction from "../lib/ai/extraction.js";
import type * as lib_ai_reasoning from "../lib/ai/reasoning.js";
import type * as lib_ai_transcription from "../lib/ai/transcription.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_functionRefs from "../lib/functionRefs.js";
import type * as lib_integrations_telegram from "../lib/integrations/telegram.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_ranking from "../lib/ranking.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_validators from "../lib/validators.js";
import type * as modules_dashboard_analytics from "../modules/dashboard/analytics.js";
import type * as modules_dashboard_overview from "../modules/dashboard/overview.js";
import type * as modules_dashboard_queues from "../modules/dashboard/queues.js";
import type * as modules_ops_aiRuns from "../modules/ops/aiRuns.js";
import type * as modules_ops_attendance from "../modules/ops/attendance.js";
import type * as modules_ops_incidents from "../modules/ops/incidents.js";
import type * as modules_ops_notifications from "../modules/ops/notifications.js";
import type * as modules_ops_tasks from "../modules/ops/tasks.js";
import type * as modules_ops_telegram from "../modules/ops/telegram.js";
import type * as modules_ops_voice from "../modules/ops/voice.js";
import type * as modules_rag_chunks from "../modules/rag/chunks.js";
import type * as modules_rag_compliance from "../modules/rag/compliance.js";
import type * as modules_rag_documentExtraction from "../modules/rag/documentExtraction.js";
import type * as modules_rag_documents from "../modules/rag/documents.js";
import type * as modules_rag_retrieval from "../modules/rag/retrieval.js";
import type * as modules_schoolCore_classes from "../modules/schoolCore/classes.js";
import type * as modules_schoolCore_rooms from "../modules/schoolCore/rooms.js";
import type * as modules_schoolCore_schedule from "../modules/schoolCore/schedule.js";
import type * as modules_schoolCore_schools from "../modules/schoolCore/schools.js";
import type * as modules_schoolCore_staff from "../modules/schoolCore/staff.js";
import type * as modules_substitutions_overrides from "../modules/substitutions/overrides.js";
import type * as modules_substitutions_planner from "../modules/substitutions/planner.js";
import type * as modules_substitutions_requests from "../modules/substitutions/requests.js";
import type * as ops from "../ops.js";
import type * as seeds_orders from "../seeds/orders.js";
import type * as seeds_schedule from "../seeds/schedule.js";
import type * as seeds_staff from "../seeds/staff.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  "lib/ai/config": typeof lib_ai_config;
  "lib/ai/embeddings": typeof lib_ai_embeddings;
  "lib/ai/extraction": typeof lib_ai_extraction;
  "lib/ai/reasoning": typeof lib_ai_reasoning;
  "lib/ai/transcription": typeof lib_ai_transcription;
  "lib/env": typeof lib_env;
  "lib/functionRefs": typeof lib_functionRefs;
  "lib/integrations/telegram": typeof lib_integrations_telegram;
  "lib/prompts": typeof lib_prompts;
  "lib/ranking": typeof lib_ranking;
  "lib/time": typeof lib_time;
  "lib/validators": typeof lib_validators;
  "modules/dashboard/analytics": typeof modules_dashboard_analytics;
  "modules/dashboard/overview": typeof modules_dashboard_overview;
  "modules/dashboard/queues": typeof modules_dashboard_queues;
  "modules/ops/aiRuns": typeof modules_ops_aiRuns;
  "modules/ops/attendance": typeof modules_ops_attendance;
  "modules/ops/incidents": typeof modules_ops_incidents;
  "modules/ops/notifications": typeof modules_ops_notifications;
  "modules/ops/tasks": typeof modules_ops_tasks;
  "modules/ops/telegram": typeof modules_ops_telegram;
  "modules/ops/voice": typeof modules_ops_voice;
  "modules/rag/chunks": typeof modules_rag_chunks;
  "modules/rag/compliance": typeof modules_rag_compliance;
  "modules/rag/documentExtraction": typeof modules_rag_documentExtraction;
  "modules/rag/documents": typeof modules_rag_documents;
  "modules/rag/retrieval": typeof modules_rag_retrieval;
  "modules/schoolCore/classes": typeof modules_schoolCore_classes;
  "modules/schoolCore/rooms": typeof modules_schoolCore_rooms;
  "modules/schoolCore/schedule": typeof modules_schoolCore_schedule;
  "modules/schoolCore/schools": typeof modules_schoolCore_schools;
  "modules/schoolCore/staff": typeof modules_schoolCore_staff;
  "modules/substitutions/overrides": typeof modules_substitutions_overrides;
  "modules/substitutions/planner": typeof modules_substitutions_planner;
  "modules/substitutions/requests": typeof modules_substitutions_requests;
  ops: typeof ops;
  "seeds/orders": typeof seeds_orders;
  "seeds/schedule": typeof seeds_schedule;
  "seeds/staff": typeof seeds_staff;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
