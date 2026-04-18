import {
  DEFAULT_AI_PROVIDER,
  DEFAULT_PROMPT_PROFILE,
} from "../env";

export const AI_CAPABILITIES = [
  "teacherMessageExtraction",
  "voiceTranscription",
  "directorCommandRouting",
  "complianceReasoning",
  "documentEmbeddings",
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];

export type AiCapabilityConfig = {
  capability: AiCapability;
  provider: string;
  model: string;
  promptProfile: string;
};

const CAPABILITY_ENV_PREFIX: Record<AiCapability, string> = {
  teacherMessageExtraction: "AI_TEACHER_MESSAGE_EXTRACTION",
  voiceTranscription: "AI_VOICE_TRANSCRIPTION",
  directorCommandRouting: "AI_DIRECTOR_COMMAND_ROUTING",
  complianceReasoning: "AI_COMPLIANCE_REASONING",
  documentEmbeddings: "AI_DOCUMENT_EMBEDDINGS",
};

export function getAiCapabilityConfig(
  capability: AiCapability,
  env: Record<string, string | undefined> = process.env,
): AiCapabilityConfig {
  const prefix = CAPABILITY_ENV_PREFIX[capability];
  const provider = env[`${prefix}_PROVIDER`] ?? env.AI_DEFAULT_PROVIDER ?? DEFAULT_AI_PROVIDER;
  const promptProfile =
    env[`${prefix}_PROMPT_PROFILE`] ??
    env.AI_DEFAULT_PROMPT_PROFILE ??
    DEFAULT_PROMPT_PROFILE;
  const model = env[`${prefix}_MODEL`] ?? env.AI_DEFAULT_MODEL;

  if (!model) {
    throw new Error(
      `No model configured for AI capability "${capability}". Set ${prefix}_MODEL or AI_DEFAULT_MODEL.`,
    );
  }

  return {
    capability,
    provider,
    model,
    promptProfile,
  };
}
