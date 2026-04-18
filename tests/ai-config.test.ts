import { describe, expect, test } from "vitest";

import {
  AI_CAPABILITIES,
  getAiCapabilityConfig,
} from "../convex/lib/ai/config";

describe("getAiCapabilityConfig", () => {
  test("returns slot-specific provider, model, and prompt profile overrides", () => {
    const env = {
      AI_DEFAULT_PROVIDER: "openai",
      AI_DEFAULT_PROMPT_PROFILE: "default",
      AI_TEACHER_MESSAGE_EXTRACTION_MODEL: "gpt-custom-teacher",
      AI_TEACHER_MESSAGE_EXTRACTION_PROMPT_PROFILE: "teacher-v1",
    };

    const result = getAiCapabilityConfig(
      "teacherMessageExtraction",
      env,
    );

    expect(result).toEqual({
      capability: "teacherMessageExtraction",
      provider: "openai",
      model: "gpt-custom-teacher",
      promptProfile: "teacher-v1",
    });
  });

  test("throws when a capability is not configured with any model", () => {
    expect(() =>
      getAiCapabilityConfig("voiceTranscription", {
        AI_DEFAULT_PROVIDER: "openai",
      }),
    ).toThrow(/voiceTranscription/i);
  });

  test("exports the supported capability list", () => {
    expect(AI_CAPABILITIES).toContain("documentEmbeddings");
  });
});
