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

/**
 * P0-2 + P1-4: the director routing prompt now classifies the intent first,
 * and emits ISO dueAt values for each task. The caller still parses dueText
 * as a fallback for relative phrasing ("завтра", "к пятнице") via
 * `parseDueText` when the LLM leaves dueAt null.
 */
export function buildDirectorRoutingPrompt(
  transcript: string,
  options: {
    todayIso: string;
    timezone: string;
    staffNames: string[];
  },
): string {
  const preview = options.staffNames.slice(0, 30).join(", ");
  return [
    "You are a scheduling assistant for a Russian-language school director.",
    `Today's date (school timezone ${options.timezone}) is ${options.todayIso}.`,
    "Classify the director transcript into one of these intents:",
    "  - task_batch: one or more tasks for staff",
    "  - substitution: the director is asking to replace an absent teacher",
    "  - order_draft: the director wants to prepare an administrative order (Приказ)",
    "  - unclear: cannot determine",
    "",
    "Return strict JSON with this schema:",
    "{",
    '  "intent": "task_batch"|"substitution"|"order_draft"|"unclear",',
    '  "tasks"?: [{"title":string,"description":string,"assigneeName":string,"dueAtIso":string|null,"dueText":string,"priority":"low"|"medium"|"high"}],',
    '  "substitution"?: {"absentTeacherName":string,"date":string,"lessons":number[],"reason":string},',
    '  "orderDraft"?: {"templateKey":string,"instruction":string}',
    "}",
    "",
    "Rules:",
    " - Always use the intent field. Only include the matching payload object.",
    " - For task_batch, assigneeName MUST be one of the staff names listed below when possible.",
    " - dueAtIso MUST be a valid ISO-8601 timestamp interpreted in the school timezone,",
    "   or null if no due date was mentioned. dueText is the natural-language snippet.",
    " - For substitution, date MUST be YYYY-MM-DD; if omitted, assume tomorrow.",
    " - Respond in Russian for task titles and descriptions; keep field names in English.",
    "",
    `Known staff (first 30): ${preview}`,
    "",
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

// P1-3: prompts for the interactive Приказ (order) generator.
export function buildOrderQuestioningPrompt(params: {
  templateTitle: string;
  templateDescription: string;
  requiredFields: Array<{ name: string; question: string; example?: string }>;
  collectedAnswers: Array<{ field: string; answer: string }>;
  instruction: string;
  context: string;
}): string {
  const fieldsList = params.requiredFields
    .map(
      (field) =>
        `  - ${field.name}: ${field.question}${field.example ? ` (e.g. ${field.example})` : ""}`,
    )
    .join("\n");
  const collected =
    params.collectedAnswers.length > 0
      ? params.collectedAnswers
          .map((entry) => `  - ${entry.field}: ${entry.answer}`)
          .join("\n")
      : "  (none yet)";
  return [
    `You are drafting a Russian-language school order ("${params.templateTitle}").`,
    `Template purpose: ${params.templateDescription}`,
    "",
    "Required fields for this template:",
    fieldsList,
    "",
    "Collected answers so far:",
    collected,
    "",
    `Director instruction: ${params.instruction}`,
    "",
    "Ministry policy context for this order type:",
    params.context,
    "",
    "Decide whether any required field is still missing. Return strict JSON:",
    '{"nextField": string|null, "question": string|null, "readyToDraft": boolean}',
    "If every required field has been collected, set readyToDraft=true and nextField=null.",
    "Otherwise pick the single most important missing field and phrase the question in Russian.",
  ].join("\n");
}

export function buildOrderComposePrompt(params: {
  templateTitle: string;
  templateDescription: string;
  collectedAnswers: Array<{ field: string; question: string; answer: string }>;
  instruction: string;
  context: string;
}): string {
  const answers = params.collectedAnswers
    .map(
      (entry) =>
        `  - ${entry.field} — "${entry.question}" → ${entry.answer}`,
    )
    .join("\n");
  return [
    `Compose a Russian-language school order ("${params.templateTitle}").`,
    `Template description: ${params.templateDescription}`,
    "",
    `Director instruction: ${params.instruction}`,
    "",
    "Ministry policy context (cite relevant paragraphs by number):",
    params.context,
    "",
    "Collected answers:",
    answers,
    "",
    "Return strict JSON:",
    '{"text": string, "citations": string[]}',
    "- text: full Russian Приказ text, formatted like a real school order with",
    "  header, preamble, numbered body clauses, signature placeholder.",
    '- citations: short strings identifying ministry sections used (e.g. "Приказ №76 п.4").',
  ].join("\n");
}
