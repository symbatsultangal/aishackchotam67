import OpenAI from "openai";

import { getAiCapabilityConfig } from "./config";

type EnvMap = Record<string, string | undefined>;

export async function embedText(
  input: string,
  env: EnvMap = process.env,
): Promise<{ provider: string; model: string; embedding: number[] }> {
  const config = getAiCapabilityConfig("documentEmbeddings", env);
  if (config.provider !== "openai") {
    throw new Error(`Unsupported embeddings provider: ${config.provider}`);
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: config.model,
    input,
  });

  return {
    provider: config.provider,
    model: config.model,
    embedding: response.data[0]?.embedding ?? [],
  };
}
