export function buildTeacherExtractionPrompt(message: string): string {
  return [
    "Classify the teacher message into one of: attendance, incident, ignore.",
    "Return strict JSON only.",
    "For attendance include: kind, classCode, presentCount, absentCount, lateCount?, confidence.",
    "For incident include: kind, title, description, category, location?, severity, confidence.",
    `Message: ${message}`,
  ].join("\n");
}

export function buildDirectorRoutingPrompt(transcript: string): string {
  return [
    "Split the director transcript into a list of structured tasks.",
    "Return strict JSON with tasks[]. Each task must include title, description, assigneeName, dueText, priority.",
    `Transcript: ${transcript}`,
  ].join("\n");
}

export function buildCompliancePrompt(inputText: string, context: string): string {
  return [
    "Check whether the operational instruction complies with the provided policy context.",
    "Return strict JSON with result, findings, citations, rewriteText.",
    "Policy context:",
    context,
    "Operational input:",
    inputText,
  ].join("\n");
}

export function buildRewritePrompt(sourceText: string, context: string): string {
  return [
    "Rewrite the source policy into a plain-English teacher checklist.",
    "Use concise bullet points and preserve legal meaning.",
    "Context:",
    context,
    "Source text:",
    sourceText,
  ].join("\n");
}
