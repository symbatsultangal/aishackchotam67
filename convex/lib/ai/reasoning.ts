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
  jsonMode?: boolean;
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
    // Responses API accepts response_format via text.format for json mode.
    ...(params.jsonMode
      ? { text: { format: { type: "json_object" as const } } }
      : {}),
  } as Parameters<typeof client.responses.create>[0]);

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

/**
 * Strip markdown code fences that LLMs sometimes wrap JSON in.
 * Handles ```json ... ``` and ``` ... ``` and trims whitespace.
 */
export function stripJsonFences(raw: string): string {
  let text = raw.trim();
  // Remove leading ```json or ``` fence
  const openFence = /^```(?:json)?\s*\n?/i;
  if (openFence.test(text)) {
    text = text.replace(openFence, "");
  }
  // Remove trailing ```
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

/**
 * Parse JSON with fence-stripping and a lightweight trailing-comma repair.
 * Returns null on unrecoverable parse failure rather than throwing, so callers
 * can mark their source record as "error" without crashing the action.
 */
export function parseLooseJson<T>(raw: string): T | null {
  const stripped = stripJsonFences(raw);
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Attempt trailing-comma repair: `,\s*[}\]]` → `$1`
    const repaired = stripped.replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}

export async function runJsonReasoning<T>(params: {
  capability: AiCapability;
  prompt: string;
  env?: EnvMap;
}): Promise<{ provider: string; model: string; json: T; rawText: string }> {
  const result = await createTextResponse({ ...params, jsonMode: true });
  const parsed = parseLooseJson<T>(result.text);
  if (parsed === null) {
    throw new Error(
      `LLM returned non-JSON output for capability "${params.capability}". Raw: ${result.text.slice(0, 200)}`,
    );
  }
  return {
    provider: result.provider,
    model: result.model,
    json: parsed,
    rawText: result.text,
  };
}
