import OpenAI from "openai";

import { getAiCapabilityConfig } from "./config";

type EnvMap = Record<string, string | undefined>;

export async function transcribeAudioBlob(
  audio: Blob,
  env: EnvMap = process.env,
  options: { language?: string } = {},
): Promise<{ provider: string; model: string; transcript: string }> {
  const config = getAiCapabilityConfig("voiceTranscription", env);
  if (config.provider !== "openai") {
    throw new Error(`Unsupported transcription provider: ${config.provider}`);
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const file = new File([audio], "voice-note.ogg", {
    type: audio.type || "audio/ogg",
  });

  const response = await client.audio.transcriptions.create({
    file,
    model: config.model,
    // P0-3: language hint reduces hallucinations for Cyrillic audio.
    ...(options.language ? { language: options.language } : {}),
  });

  return {
    provider: config.provider,
    model: config.model,
    transcript: response.text,
  };
}
