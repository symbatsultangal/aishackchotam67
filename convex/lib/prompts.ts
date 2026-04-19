export function buildTeacherExtractionPrompt(message: string): string {
  return [
    "You classify short school staff messages into one of: attendance, incident, ignore.",
    "Messages may be in English, Russian, Kazakh, or mixed transliterated school shorthand.",
    "Return strict JSON only with no markdown and no explanatory text.",
    "Attendance means a class attendance report such as class code plus present and absent counts.",
    "Incident means a facilities, safety, discipline, or operational problem that should become an incident and possibly a task.",
    "Ignore greetings, unclear chatter, or anything that cannot be confidently turned into attendance or incident data.",
    "For attendance include: kind, classCode, presentCount, absentCount, lateCount?, confidence.",
    "For incident include: kind, title, description, category, location?, severity, confidence.",
    'Example attendance JSON: {"kind":"attendance","classCode":"1A","presentCount":24,"absentCount":2,"confidence":0.96}',
    'Example incident JSON: {"kind":"incident","title":"Broken window","description":"A classroom window is cracked and unsafe","category":"facilities","location":"Room 12","severity":"medium","confidence":0.9}',
    'Example ignore JSON: {"kind":"ignore","reason":"not an attendance or incident message","confidence":0.8}',
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
