export const DEFAULT_AI_PROVIDER = "openai";
export const DEFAULT_PROMPT_PROFILE = "default";
export const DEFAULT_EMBEDDING_DIMENSIONS = 3072;

export function getEnv(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env[name];
}

export function getRequiredEnv(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = getEnv(name, env);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalNumberEnv(
  name: string,
  fallback: number,
  env: Record<string, string | undefined> = process.env,
): number {
  const value = getEnv(name, env);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}
