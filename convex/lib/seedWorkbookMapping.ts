export type SeedMutationTarget =
  | "modules/schoolCore/schedule:seed"
  | "modules/schoolCore/schedule:seedCompositeEntries"
  | "modules/schoolCore/timeSlots:upsertMany"
  | "modules/schoolCore/rooms:upsertMany"
  | "modules/schoolCore/rooms:upsertDetails"
  | "modules/schoolCore/staff:seed"
  | "modules/schoolCore/staff:upsertLoadProfiles"
  | "modules/schoolCore/assessments:upsertMany";

type ScheduleCellAssessment = {
  rawCellText?: string | null;
  rawRoomText?: string | null;
};

type TimeSlotAssessment = {
  lessonNumber?: number | null;
  timeLabel?: string | null;
};

type RoomCatalogAssessment = {
  code?: string | null;
  capacity?: number | null;
  floor?: number | null;
  managerName?: string | null;
  homeClassCode?: string | null;
  description?: string | null;
};

type WorkloadRowAssessment = {
  rowKind: "teacher_start" | "teacher_subject_continuation";
  teacherName?: string | null;
  subject?: string | null;
  diplomaSpecialty?: string | null;
  weeklyLoadTarget?: number | null;
};

type WorkloadAssessmentOptions = {
  persistWorkbookFields?: boolean;
};

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

export function looksCompositeScheduleCell({
  rawCellText,
  rawRoomText,
}: ScheduleCellAssessment): boolean {
  if (!hasText(rawCellText)) {
    return false;
  }

  const compactCellText = rawCellText!.replace(/\s+/g, " ").trim();
  if (compactCellText.includes("/") || compactCellText.includes("(")) {
    return true;
  }

  return Boolean(rawRoomText && /[,/]/.test(rawRoomText));
}

export function assessScheduleCellMutation({
  rawCellText,
  rawRoomText,
}: ScheduleCellAssessment): SeedMutationTarget | null {
  if (!hasText(rawCellText)) {
    return null;
  }

  return looksCompositeScheduleCell({ rawCellText, rawRoomText })
    ? "modules/schoolCore/schedule:seedCompositeEntries"
    : "modules/schoolCore/schedule:seed";
}

export function assessTimeSlotMutation({
  lessonNumber,
  timeLabel,
}: TimeSlotAssessment): SeedMutationTarget | null {
  if (!lessonNumber || !hasText(timeLabel)) {
    return null;
  }

  return "modules/schoolCore/timeSlots:upsertMany";
}

export function assessRoomCatalogMutations(
  row: RoomCatalogAssessment,
): SeedMutationTarget[] {
  if (!hasText(row.code)) {
    return [];
  }

  const mutations: SeedMutationTarget[] = ["modules/schoolCore/rooms:upsertMany"];
  const hasDetailFields =
    row.floor !== undefined &&
    row.floor !== null ||
    hasText(row.managerName) ||
    hasText(row.homeClassCode) ||
    hasText(row.description);

  if (hasDetailFields) {
    mutations.push("modules/schoolCore/rooms:upsertDetails");
  }

  return mutations;
}

export function assessWorkloadRowMutations(
  row: WorkloadRowAssessment,
  options: WorkloadAssessmentOptions = {},
): SeedMutationTarget[] {
  if (row.rowKind === "teacher_start" && hasText(row.teacherName)) {
    return options.persistWorkbookFields
      ? [
          "modules/schoolCore/staff:seed",
          "modules/schoolCore/staff:upsertLoadProfiles",
        ]
      : ["modules/schoolCore/staff:seed"];
  }

  if (!hasText(row.subject)) {
    return [];
  }

  return options.persistWorkbookFields
    ? ["modules/schoolCore/staff:upsertLoadProfiles"]
    : ["modules/schoolCore/staff:seed"];
}

export function assessAssessmentSheetMutation(
  sheetName: string,
): SeedMutationTarget | null {
  const normalized = sheetName.toLowerCase();
  if (normalized.includes("тжб") || normalized.includes("бжб")) {
    return "modules/schoolCore/assessments:upsertMany";
  }

  return null;
}
