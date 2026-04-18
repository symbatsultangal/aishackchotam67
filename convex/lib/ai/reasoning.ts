import OpenAI from "openai";

import { getAiCapabilityConfig, type AiCapability } from "./config";

type EnvMap = Record<string, string | undefined>;

function getOpenAiClient(env: EnvMap = process.env): OpenAI {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
}

async function createTextResponse(params: {
  capability: AiCapability;
  prompt: string;
  env?: EnvMap;
}): Promise<{ provider: string; model: string; text: string }> {
  const env = params.env ?? process.env;
  const capabilityConfig = getAiCapabilityConfig(params.capability, env);

  if (capabilityConfig.provider !== "openai") {
    throw new Error(
      `Unsupported AI provider "${capabilityConfig.provider}" for ${params.capability}`,
    );
  }

  const client = getOpenAiClient(env);
  const response = await client.responses.create({
    model: capabilityConfig.model,
    input: params.prompt,
  });

  return {
    provider: capabilityConfig.provider,
    model: capabilityConfig.model,
    text: response.output_text,
  };
}

export async function runTextReasoning(params: {
  capability: AiCapability;
  prompt: string;
  env?: EnvMap;
}): Promise<{ provider: string; model: string; text: string }> {
  return createTextResponse(params);
}

export async function runJsonReasoning<T>(params: {
  capability: AiCapability;
  prompt: string;
  env?: EnvMap;
}): Promise<{ provider: string; model: string; json: T; rawText: string }> {
  const result = await createTextResponse(params);
  const json = JSON.parse(result.text) as T;
  return {
    provider: result.provider,
    model: result.model,
    json,
    rawText: result.text,
  };
}
