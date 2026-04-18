import { buildTeacherExtractionPrompt } from "../prompts";
import { normalizeTeacherExtraction, validateTeacherExtraction } from "../validators";
import { runJsonReasoning } from "./reasoning";

export async function runTeacherMessageExtraction(message: string) {
  const result = await runJsonReasoning({
    capability: "teacherMessageExtraction",
    prompt: buildTeacherExtractionPrompt(message),
  });
  const normalized = normalizeTeacherExtraction(result.json as Record<string, unknown>);
  const validation = validateTeacherExtraction(normalized);

  if (validation.ok) {
    return {
      ...result,
      extraction: normalized,
    };
  }

  throw new Error(
    `Invalid teacher extraction payload: ${validation.issues.join(", ")}`,
  );
}
