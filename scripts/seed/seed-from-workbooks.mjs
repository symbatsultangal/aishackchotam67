import path from "node:path";
import xlsx from "xlsx";

import { createConvexClient, mutationRef, queryRef } from "../telegram/_convex.mjs";
import { loadLocalEnv, parseArgs } from "../telegram/_env.mjs";

loadLocalEnv();

const DEFAULT_SCHEDULE_WORKBOOK = "для хакатона расписание.xlsx";
const DEFAULT_WORKLOAD_WORKBOOK =
  "нагрузка учителей для хакатона 2025-2026.xlsx";
const DEFAULT_SCHOOL_NAME = "Hackathon School 2025-2026";
const DEFAULT_TIMEZONE = "Asia/Qyzylorda";
const DEFAULT_LOCALE = "kk-KZ";

const WEEKDAY_RULES = [
  { keyword: "дүйсенбі", weekday: 1 },
  { keyword: "сейсенбі", weekday: 2 },
  { keyword: "сәрсенбі", weekday: 3 },
  { keyword: "бейсенбі", weekday: 4 },
  { keyword: "жұма", weekday: 5 },
];

const CHAR_FOLD_MAP = new Map(
  Object.entries({
    а: "a",
    ә: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "i",
    і: "i",
    к: "k",
    қ: "k",
    л: "l",
    м: "m",
    н: "n",
    ң: "n",
    о: "o",
    ө: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ұ: "u",
    ү: "u",
    ф: "f",
    х: "h",
    һ: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya",
    ъ: "",
    ь: "",
    "№": "n",
  }),
);

function text(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\u00a0/g, " ").trim();
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = text(value).replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function foldMatch(value) {
  const input = text(value).toLowerCase().normalize("NFKD");
  let output = "";

  for (const char of input) {
    if (/[\u0300-\u036f]/u.test(char)) {
      continue;
    }

    const mapped = CHAR_FOLD_MAP.get(char);
    if (mapped !== undefined) {
      output += mapped;
      continue;
    }

    if (/[a-z0-9]/u.test(char)) {
      output += char;
      continue;
    }

    output += " ";
  }

  return output.replace(/\s+/g, " ").trim();
}

function normalizeClassCode(value) {
  const compact = foldMatch(value).toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/^(\d+)([A-Z])$/);
  return match ? `${match[1]}${match[2]}` : "";
}

function gradeFromClassCode(classCode) {
  const match = classCode.match(/^(\d+)/);
  return match ? match[1] : "";
}

function normalizeRoomCode(value) {
  return foldMatch(value).replace(/\s+/g, " ").trim();
}

function roomKeyFromCode(code) {
  const suffix = normalizeRoomCode(code).replace(/[^a-z0-9]+/g, "_") || "room";
  return `room_${suffix}`;
}

function staffKeyFromName(name) {
  const suffix = foldMatch(name).replace(/[^a-z0-9]+/g, "_") || "staff";
  return `staff_${suffix}`;
}

function parseTimeRange(value) {
  const raw = text(value);
  const directMatch = raw.match(
    /(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})/u,
  );
  const fallbackMatch =
    directMatch ?? raw.match(/(\d{1,2})[.:](\d{2}).*?(\d{1,2})[.:](\d{2})/u);

  if (!fallbackMatch) {
    return null;
  }

  const [, startHour, startMinute, endHour, endMinute] = fallbackMatch;
  return {
    startTime: `${startHour.padStart(2, "0")}:${startMinute}`,
    endTime: `${endHour.padStart(2, "0")}:${endMinute}`,
  };
}

function readWorkbook(workbookPath) {
  return xlsx.readFile(workbookPath, {
    cellDates: false,
    raw: false,
  });
}

function readSheetRows(workbook, sheetName) {
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: null,
  });
}

function findSheetName(workbook, keyword, fallbackIndex = 0) {
  const normalizedKeyword = foldMatch(keyword);
  return (
    workbook.SheetNames.find((sheetName) =>
      foldMatch(sheetName).includes(normalizedKeyword),
    ) ?? workbook.SheetNames[fallbackIndex]
  );
}

function extractAcademicYear(...values) {
  for (const value of values) {
    const match = text(value).match(/20\d{2}-20\d{2}/u);
    if (match) {
      return match[0];
    }
  }

  return "2025-2026";
}

function findHeaderRowIndex(rows, predicate) {
  return rows.findIndex((row) => row.some((cell, index) => predicate(cell, row, index)));
}

function buildTeacherRecord(name) {
  return {
    key: staffKeyFromName(name),
    fullName: name,
    displayName: name,
    roles: ["teacher"],
    subjects: new Set(),
    grades: new Set(),
    qualifications: new Set(),
    telegramEnabled: false,
    dashboardAccess: true,
    isActive: true,
    diplomaSpecialty: undefined,
    weeklyLoadTarget: undefined,
    subjectLoads: [],
  };
}

function parseWorkloadWorkbook(workloadPath) {
  const workbook = readWorkbook(workloadPath);
  const workloadSheetName = findSheetName(workbook, "жүктеме", 0);
  const roomSheetName = findSheetName(workbook, "кабинеттер", 2);
  const timeSheetName = findSheetName(workbook, "күн тәртібі", workbook.SheetNames.length - 1);

  const workloadRows = readSheetRows(workbook, workloadSheetName);
  const roomRows = readSheetRows(workbook, roomSheetName);
  const timeRows = readSheetRows(workbook, timeSheetName);

  const headerRowIndex = workloadRows.findIndex((row) => {
    const classHeaderCount = row.filter((cell) => normalizeClassCode(cell)).length;
    return classHeaderCount >= 5 && Boolean(text(row[3]));
  });
  if (headerRowIndex < 0) {
    throw new Error("Could not find workload header row");
  }

  const headerRow = workloadRows[headerRowIndex];
  const classColumns = [];
  const bandColumns = [];
  let totalAssignedLoadColumn = null;
  let weeklyLoadColumn = null;

  for (let index = 0; index < headerRow.length; index += 1) {
    const classCode = normalizeClassCode(headerRow[index]);
    if (classCode) {
      classColumns.push({ index, classCode });
      continue;
    }

    const normalizedHeader = foldMatch(headerRow[index]).replace(/\s+/g, "");
    if (normalizedHeader.includes("kl") && /\d/.test(normalizedHeader)) {
      bandColumns.push({ index, label: text(headerRow[index]) });
      continue;
    }

    if (normalizedHeader.includes("barlygy")) {
      totalAssignedLoadColumn = index;
      continue;
    }

    if (normalizedHeader.includes("aptalyk")) {
      weeklyLoadColumn = index;
    }
  }

  const teacherMap = new Map();
  let currentTeacherName = null;

  for (let rowIndex = headerRowIndex + 1; rowIndex < workloadRows.length; rowIndex += 1) {
    const row = workloadRows[rowIndex];
    const teacherName = text(row[1]);
    const diplomaSpecialty = text(row[2]);
    const subject = text(row[3]);

    if (teacherName) {
      currentTeacherName = teacherName;
      if (!teacherMap.has(teacherName)) {
        teacherMap.set(teacherName, buildTeacherRecord(teacherName));
      }
    }

    if (!currentTeacherName) {
      continue;
    }

    const teacher = teacherMap.get(currentTeacherName);
    if (diplomaSpecialty) {
      teacher.qualifications.add(diplomaSpecialty);
      teacher.diplomaSpecialty ??= diplomaSpecialty;
    }

    if (!subject) {
      continue;
    }

    teacher.subjects.add(subject);

    const classLoads = [];
    const bandLoads = [];
    for (const column of classColumns) {
      const load = numberValue(row[column.index]);
      if (!load || load <= 0) {
        continue;
      }

      classLoads.push({
        classCode: column.classCode,
        load,
      });
      teacher.grades.add(gradeFromClassCode(column.classCode));
    }

    for (const column of bandColumns) {
      const load = numberValue(row[column.index]);
      if (!load || load <= 0) {
        continue;
      }

      bandLoads.push({
        label: column.label,
        load,
      });
    }

    const totalLoad =
      totalAssignedLoadColumn === null
        ? null
        : numberValue(row[totalAssignedLoadColumn]);
    const weeklyLoadTarget =
      weeklyLoadColumn === null ? null : numberValue(row[weeklyLoadColumn]);

    if (weeklyLoadTarget !== null) {
      teacher.weeklyLoadTarget = weeklyLoadTarget;
    }

    teacher.subjectLoads.push({
      subject,
      classLoads,
      bandLoads,
      ...(totalLoad !== null ? { totalLoad } : {}),
    });
  }

  const roomHeaderIndex = roomRows.findIndex(
    (row) => foldMatch(row[1]) === "kabinet",
  );
  const rooms = [];
  for (let rowIndex = roomHeaderIndex + 1; rowIndex < roomRows.length; rowIndex += 1) {
    const row = roomRows[rowIndex];
    const code = text(row[1]);
    if (!code) {
      continue;
    }

    rooms.push({
      key: roomKeyFromCode(code),
      code,
      capacity: numberValue(row[3]) ?? undefined,
      floor: numberValue(row[2]) ?? undefined,
      homeClassCode: normalizeClassCode(row[4]) || undefined,
      managerName: text(row[5]) || undefined,
      description: text(row[6]) || undefined,
      active: true,
    });
  }

  const timeSlots = [];
  for (const row of timeRows) {
    const lessonNumber = Number.parseInt(text(row[0]), 10);
    const timeRange = parseTimeRange(row[1]);
    if (!Number.isInteger(lessonNumber) || !timeRange) {
      continue;
    }

    for (const weekday of [1, 2, 3, 4, 5]) {
      timeSlots.push({
        weekday,
        lessonNumber,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
      });
    }
  }

  const classCodes = uniq(classColumns.map((column) => column.classCode));
  const classes = classCodes.map((code) => ({
    key: `class_${code.toLowerCase()}`,
    code,
    grade: gradeFromClassCode(code),
    active: true,
  }));

  const staff = [...teacherMap.values()].map((teacher) => ({
    key: teacher.key,
    fullName: teacher.fullName,
    displayName: teacher.displayName,
    roles: teacher.roles,
    subjects: [...teacher.subjects],
    grades: [...teacher.grades],
    qualifications: [...teacher.qualifications],
    telegramEnabled: teacher.telegramEnabled,
    dashboardAccess: teacher.dashboardAccess,
    isActive: teacher.isActive,
  }));

  const loadProfiles = [...teacherMap.values()]
    .filter((teacher) => teacher.subjectLoads.length > 0)
    .map((teacher) => {
      const totalAssignedLoad = teacher.subjectLoads.reduce(
        (sum, subjectLoad) => sum + (subjectLoad.totalLoad ?? 0),
        0,
      );

      return {
        staffKey: teacher.key,
        academicYear: extractAcademicYear(workloadPath, workloadSheetName),
        sourceSheet: workloadSheetName,
        ...(teacher.diplomaSpecialty
          ? { diplomaSpecialty: teacher.diplomaSpecialty }
          : {}),
        ...(teacher.weeklyLoadTarget !== undefined
          ? { weeklyLoadTarget: teacher.weeklyLoadTarget }
          : {}),
        ...(totalAssignedLoad > 0 ? { totalAssignedLoad } : {}),
        subjectLoads: teacher.subjectLoads,
      };
    });

  return {
    academicYear: extractAcademicYear(workloadPath, workloadSheetName),
    staff,
    classes,
    rooms,
    timeSlots,
    loadProfiles,
  };
}

function ensurePlaceholderRoles(staff, schoolName) {
  const existingRoles = new Set(staff.flatMap((member) => member.roles));
  const placeholders = [];

  const placeholderFactory = (role, suffix, options = {}) => ({
    key: `placeholder_${role}`,
    fullName: `${schoolName} ${suffix}`,
    displayName: `${schoolName} ${suffix}`,
    roles: [role],
    subjects: options.subjects ?? [],
    grades: [],
    qualifications: ["Auto-created placeholder for missing workbook role"],
    telegramEnabled: false,
    dashboardAccess: true,
    isActive: true,
  });

  if (!existingRoles.has("director")) {
    placeholders.push(placeholderFactory("director", "Director"));
  }

  if (!existingRoles.has("vice_principal")) {
    placeholders.push(placeholderFactory("vice_principal", "Vice Principal"));
  }

  if (!existingRoles.has("admin")) {
    placeholders.push(placeholderFactory("admin", "Admin"));
  }

  if (!existingRoles.has("facilities")) {
    placeholders.push(
      placeholderFactory("facilities", "Facilities", {
        subjects: ["Facilities"],
      }),
    );
  }

  return [...staff, ...placeholders];
}

function buildTeacherMatchers(staff) {
  return staff
    .filter((member) => member.roles.includes("teacher") || member.roles.includes("vice_principal"))
    .map((member) => {
      const nameParts = text(member.fullName).split(/\s+/u).filter(Boolean);
      const surname = nameParts[0] ?? text(member.fullName);
      const initials = nameParts.slice(1).map((part) => part[0]).filter(Boolean);
      const rawAliases = uniq([
        member.fullName,
        member.displayName,
        surname,
        initials.length > 0 ? `${surname} ${initials[0]}.` : "",
        initials.length > 0 ? `${surname} ${initials[0]}` : "",
        initials.length > 1 ? `${surname} ${initials.join(".")}.` : "",
        initials.length > 1 ? `${surname} ${initials.join("")}` : "",
      ]);
      const normalizedAliases = uniq(
        rawAliases.map((alias) => foldMatch(alias)).filter((alias) => alias.length >= 4),
      );

      return {
        key: member.key,
        fullName: member.fullName,
        rawAliases,
        normalizedAliases,
      };
    });
}

function stripTeacherAlias(rawCellText, rawAliases) {
  let subject = text(rawCellText);
  const sortedAliases = [...rawAliases].sort((left, right) => right.length - left.length);

  for (const alias of sortedAliases) {
    if (!alias) {
      continue;
    }

    const pattern = new RegExp(escapeRegExp(alias), "iu");
    if (pattern.test(subject)) {
      subject = subject.replace(pattern, " ");
    }
  }

  subject = subject.replace(/\s+/g, " ").trim();
  return subject || text(rawCellText);
}

function matchTeacher(rawCellText, teacherMatchers) {
  const normalizedCell = foldMatch(rawCellText);
  const candidates = [];

  for (const matcher of teacherMatchers) {
    let longestAlias = "";
    for (const alias of matcher.normalizedAliases) {
      if (normalizedCell.includes(alias) && alias.length > longestAlias.length) {
        longestAlias = alias;
      }
    }

    if (longestAlias) {
      candidates.push({ matcher, alias: longestAlias });
    }
  }

  const deduped = [];
  const seenKeys = new Set();
  for (const candidate of candidates.sort((left, right) => right.alias.length - left.alias.length)) {
    if (seenKeys.has(candidate.matcher.key)) {
      continue;
    }
    seenKeys.add(candidate.matcher.key);
    deduped.push(candidate);
  }

  if (deduped.length === 0) {
    return { status: "unresolved" };
  }

  if (deduped.length > 1) {
    return {
      status: "ambiguous",
      candidates: deduped.map((candidate) => candidate.matcher.fullName),
    };
  }

  const { matcher } = deduped[0];
  return {
    status: "resolved",
    teacherKey: matcher.key,
    teacherName: matcher.fullName,
    subject: stripTeacherAlias(rawCellText, matcher.rawAliases),
  };
}

function splitRoomParts(rawRoomText) {
  return text(rawRoomText)
    .split(/[\/,]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function looksCompositeCell(rawCellText, rawRoomText) {
  const cell = text(rawCellText);
  const room = text(rawRoomText);
  if (!cell) {
    return false;
  }

  return /[\/()]/u.test(cell) || /[\/,]/u.test(room);
}

function buildCompositeComponents(rawCellText, rawRoomText, teacherMatchers) {
  const cellParts = text(rawCellText)
    .split(/\s*\/\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const components = cellParts.length > 0 ? cellParts : [text(rawCellText)];
  const roomParts = splitRoomParts(rawRoomText);

  return components.map((cellPart, index) => {
    const teacherMatch = matchTeacher(cellPart, teacherMatchers);
    const roomCode =
      roomParts[index] ?? (roomParts.length === 1 ? roomParts[0] : undefined);
    const component = {
      subject:
        teacherMatch.status === "resolved"
          ? teacherMatch.subject
          : cellPart,
      ...(roomCode ? { roomCode } : {}),
    };

    if (teacherMatch.status === "resolved") {
      return {
        ...component,
        teacherKey: teacherMatch.teacherKey,
        teacherName: teacherMatch.teacherName,
      };
    }

    return {
      ...component,
      notes:
        teacherMatch.status === "ambiguous"
          ? "teacher_alias_ambiguous"
          : "teacher_alias_unresolved",
    };
  });
}

function mergeRooms(baseRooms, additionalRoomCodes) {
  const merged = [];
  const seenCodes = new Set();

  const addRoom = (room) => {
    const normalizedCode = normalizeRoomCode(room.code);
    if (!normalizedCode || seenCodes.has(normalizedCode)) {
      return;
    }

    seenCodes.add(normalizedCode);
    merged.push(room);
  };

  for (const room of baseRooms) {
    addRoom(room);
  }

  for (const code of additionalRoomCodes) {
    addRoom({
      key: roomKeyFromCode(code),
      code,
      active: true,
    });
  }

  return merged;
}

function parseScheduleWorkbook(schedulePath, classes, staff) {
  const workbook = readWorkbook(schedulePath);
  const scheduleSheetName = findSheetName(workbook, "сабақ", 0);
  const scheduleRows = readSheetRows(workbook, scheduleSheetName);
  const teacherMatchers = buildTeacherMatchers(staff);
  const knownClassCodes = new Set(classes.map((item) => item.code));

  const headerRowIndex = scheduleRows.findIndex((row) => {
    const classHeaderCount = row.filter((cell) => normalizeClassCode(cell)).length;
    return text(row[1]) === "№" && classHeaderCount >= 5;
  });
  if (headerRowIndex < 0) {
    throw new Error("Could not find schedule header row");
  }

  const headerRow = scheduleRows[headerRowIndex];
  const classColumns = [];
  for (let index = 0; index < headerRow.length; index += 1) {
    const classCode = normalizeClassCode(headerRow[index]);
    if (!classCode || !knownClassCodes.has(classCode)) {
      continue;
    }

    classColumns.push({
      classCode,
      lessonCol: index,
      roomCol: index + 1,
      lessonNumberCol: index >= 26 ? 25 : 1,
    });
  }

  let weekday = null;
  const simpleEntries = [];
  const compositeEntries = [];
  const roomCodes = new Set();
  const unresolvedTeacherCells = new Set();
  const ambiguousTeacherCells = new Set();

  for (let rowIndex = headerRowIndex + 1; rowIndex < scheduleRows.length; rowIndex += 1) {
    const row = scheduleRows[rowIndex];
    const dayText = foldMatch(row[0]);
    for (const rule of WEEKDAY_RULES) {
      if (dayText.includes(foldMatch(rule.keyword))) {
        weekday = rule.weekday;
      }
    }

    for (const column of classColumns) {
      const lessonNumber = Number.parseInt(text(row[column.lessonNumberCol]), 10);
      if (!weekday || !Number.isInteger(lessonNumber)) {
        continue;
      }

      const rawCellText = text(row[column.lessonCol]);
      const rawRoomText = text(row[column.roomCol]);
      if (!rawCellText) {
        continue;
      }

      for (const roomCode of splitRoomParts(rawRoomText)) {
        roomCodes.add(roomCode);
      }

      const teacherMatch = matchTeacher(rawCellText, teacherMatchers);
      const roomParts = splitRoomParts(rawRoomText);
      const sourceRowKey = `${weekday}:${lessonNumber}:${column.classCode}`;

      if (
        !looksCompositeCell(rawCellText, rawRoomText) &&
        teacherMatch.status === "resolved" &&
        roomParts.length === 1
      ) {
        simpleEntries.push({
          classKey: `class_${column.classCode.toLowerCase()}`,
          weekday,
          lessonNumber,
          subject: teacherMatch.subject,
          teacherKey: teacherMatch.teacherKey,
          roomCode: roomParts[0],
        });
        continue;
      }

      if (teacherMatch.status === "unresolved") {
        unresolvedTeacherCells.add(rawCellText);
      }

      if (teacherMatch.status === "ambiguous") {
        ambiguousTeacherCells.add(rawCellText);
      }

      compositeEntries.push({
        classKey: `class_${column.classCode.toLowerCase()}`,
        weekday,
        lessonNumber,
        rawCellText,
        rawRoomText: rawRoomText || undefined,
        sourceSheet: scheduleSheetName,
        sourceRowKey,
        active: true,
        components: buildCompositeComponents(rawCellText, rawRoomText, teacherMatchers),
      });
    }
  }

  return {
    simpleEntries,
    compositeEntries,
    roomCodes: [...roomCodes],
    warnings: {
      unresolvedTeacherCells: [...unresolvedTeacherCells],
      ambiguousTeacherCells: [...ambiguousTeacherCells],
    },
  };
}

function buildOpsSeed({ schoolName, rooms, directorId, adminId, facilitiesId }) {
  const firstRoom = rooms[0]?.code ?? "Main Campus";
  const secondRoom = rooms[1]?.code ?? firstRoom;

  const incidents = [
    {
      title: `${schoolName}: maintenance check for ${firstRoom}`,
      description: `Seeded follow-up for ${firstRoom} after workbook import.`,
      category: "facilities",
      location: firstRoom,
      severity: "medium",
      reportedByStaffId: directorId,
    },
    {
      title: `${schoolName}: equipment check for ${secondRoom}`,
      description: `Seeded equipment review for ${secondRoom} after workbook import.`,
      category: "equipment",
      location: secondRoom,
      severity: "low",
      reportedByStaffId: adminId,
    },
  ];

  const tasks = [
    {
      title: `${schoolName}: inspect ${firstRoom}`,
      description: `Follow up on the seeded incident for ${firstRoom}.`,
      assigneeStaffId: facilitiesId,
      creatorStaffId: directorId,
      priority: "medium",
      relatedIncidentTitle: incidents[0].title,
    },
    {
      title: `${schoolName}: inspect ${secondRoom}`,
      description: `Follow up on the seeded incident for ${secondRoom}.`,
      assigneeStaffId: facilitiesId,
      creatorStaffId: adminId,
      priority: "low",
      relatedIncidentTitle: incidents[1].title,
    },
    {
      title: `${schoolName}: review imported schedule`,
      description: "Spot-check the workbook-backed seed data in the dashboard.",
      assigneeStaffId: directorId,
      creatorStaffId: adminId,
      priority: "medium",
    },
  ];

  return { incidents, tasks };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();

  const schoolName = args["school-name"] ?? DEFAULT_SCHOOL_NAME;
  const timezone = args.timezone ?? DEFAULT_TIMEZONE;
  const locale = args.locale ?? DEFAULT_LOCALE;
  const dryRun = args["dry-run"] === "true";
  const scheduleWorkbook = path.resolve(
    root,
    args["schedule-workbook"] ?? DEFAULT_SCHEDULE_WORKBOOK,
  );
  const workloadWorkbook = path.resolve(
    root,
    args["workload-workbook"] ?? DEFAULT_WORKLOAD_WORKBOOK,
  );

  const workload = parseWorkloadWorkbook(workloadWorkbook);
  const staff = ensurePlaceholderRoles(workload.staff, schoolName);
  const schedule = parseScheduleWorkbook(scheduleWorkbook, workload.classes, staff);
  const rooms = mergeRooms(workload.rooms, schedule.roomCodes);

  const dryRunSummary = {
    schoolName,
    timezone,
    locale,
    counts: {
      staff: staff.length,
      loadProfiles: workload.loadProfiles.length,
      classes: workload.classes.length,
      rooms: rooms.length,
      timeSlots: workload.timeSlots.length,
      scheduleSimple: schedule.simpleEntries.length,
      scheduleComposite: schedule.compositeEntries.length,
    },
    warnings: {
      unresolvedTeacherCells: schedule.warnings.unresolvedTeacherCells.slice(0, 20),
      ambiguousTeacherCells: schedule.warnings.ambiguousTeacherCells.slice(0, 20),
    },
  };

  if (dryRun) {
    console.log(JSON.stringify(dryRunSummary, null, 2));
    return;
  }

  const client = createConvexClient();

  const schoolId = await client.mutation(
    mutationRef("modules/schoolCore/schools:ensureSchool"),
    {
      name: schoolName,
      timezone,
      locale,
    },
  );

  const staffIds = await client.mutation(
    mutationRef("modules/schoolCore/staff:seed"),
    {
      schoolId,
      staff: staff.map(({ key: _key, ...member }) => member),
    },
  );
  const staffIdByKey = new Map(staff.map((member, index) => [member.key, staffIds[index]]));

  const classes = workload.classes.map((item) => ({
    ...item,
    homeroomTeacherKey: staff.find(
      (member) =>
        member.roles.includes("teacher") && member.grades.includes(item.grade),
    )?.key,
  }));

  const classIds = await client.mutation(
    mutationRef("modules/schoolCore/classes:upsertMany"),
    {
      schoolId,
      classes: classes.map((item) => ({
        code: item.code,
        grade: item.grade,
        active: item.active,
        ...(item.homeroomTeacherKey
          ? { homeroomTeacherId: staffIdByKey.get(item.homeroomTeacherKey) }
          : {}),
      })),
    },
  );
  const classIdByKey = new Map(classes.map((item, index) => [item.key, classIds[index]]));

  const roomIds = await client.mutation(
    mutationRef("modules/schoolCore/rooms:upsertMany"),
    {
      schoolId,
      rooms: rooms.map((room) => ({
        code: room.code,
        ...(room.capacity !== undefined ? { capacity: room.capacity } : {}),
        active: room.active,
      })),
    },
  );
  const roomIdByKey = new Map(rooms.map((room, index) => [room.key, roomIds[index]]));
  const roomIdByCode = new Map(
    rooms.map((room) => [normalizeRoomCode(room.code), roomIdByKey.get(room.key)]),
  );

  await client.mutation(mutationRef("modules/schoolCore/rooms:upsertDetails"), {
    schoolId,
    rooms: workload.rooms.map((room) => ({
      code: room.code,
      ...(room.capacity !== undefined ? { capacity: room.capacity } : {}),
      ...(room.floor !== undefined ? { floor: room.floor } : {}),
      ...(room.homeClassCode ? { homeClassCode: room.homeClassCode } : {}),
      ...(room.managerName ? { managerName: room.managerName } : {}),
      ...(room.description ? { description: room.description } : {}),
      active: room.active,
    })),
  });

  await client.mutation(mutationRef("modules/schoolCore/timeSlots:upsertMany"), {
    schoolId,
    timeSlots: workload.timeSlots,
  });

  if (workload.loadProfiles.length > 0) {
    await client.mutation(
      mutationRef("modules/schoolCore/staff:upsertLoadProfiles"),
      {
        schoolId,
        profiles: workload.loadProfiles
          .map((profile) => ({
            academicYear: profile.academicYear,
            ...(profile.sourceSheet ? { sourceSheet: profile.sourceSheet } : {}),
            staffId: staffIdByKey.get(profile.staffKey),
            ...(profile.diplomaSpecialty
              ? { diplomaSpecialty: profile.diplomaSpecialty }
              : {}),
            ...(profile.weeklyLoadTarget !== undefined
              ? { weeklyLoadTarget: profile.weeklyLoadTarget }
              : {}),
            ...(profile.totalAssignedLoad !== undefined
              ? { totalAssignedLoad: profile.totalAssignedLoad }
              : {}),
            subjectLoads: profile.subjectLoads,
          }))
          .filter((profile) => profile.staffId),
      },
    );
  }

  const simpleSchedulePayload = schedule.simpleEntries
    .map((entry) => {
      const classId = classIdByKey.get(entry.classKey);
      const teacherId = staffIdByKey.get(entry.teacherKey);
      const roomId = roomIdByCode.get(normalizeRoomCode(entry.roomCode));
      if (!classId || !teacherId || !roomId) {
        return null;
      }

      return {
        classId,
        weekday: entry.weekday,
        lessonNumber: entry.lessonNumber,
        subject: entry.subject,
        teacherId,
        roomId,
      };
    })
    .filter(Boolean);

  const compositeSchedulePayload = schedule.compositeEntries
    .map((entry) => {
      const classId = classIdByKey.get(entry.classKey);
      if (!classId) {
        return null;
      }

      return {
        classId,
        weekday: entry.weekday,
        lessonNumber: entry.lessonNumber,
        rawCellText: entry.rawCellText,
        ...(entry.rawRoomText ? { rawRoomText: entry.rawRoomText } : {}),
        ...(entry.sourceSheet ? { sourceSheet: entry.sourceSheet } : {}),
        ...(entry.sourceRowKey ? { sourceRowKey: entry.sourceRowKey } : {}),
        active: entry.active,
        components: entry.components.map((component) => ({
          subject: component.subject,
          ...(component.teacherName ? { teacherName: component.teacherName } : {}),
          ...(component.teacherKey && staffIdByKey.get(component.teacherKey)
            ? { teacherId: staffIdByKey.get(component.teacherKey) }
            : {}),
          ...(component.roomCode ? { roomCode: component.roomCode } : {}),
          ...(component.roomCode && roomIdByCode.get(normalizeRoomCode(component.roomCode))
            ? { roomId: roomIdByCode.get(normalizeRoomCode(component.roomCode)) }
            : {}),
          ...(component.notes ? { notes: component.notes } : {}),
        })),
      };
    })
    .filter(Boolean);

  const scheduleTemplateIds =
    simpleSchedulePayload.length > 0
      ? await client.mutation(mutationRef("modules/schoolCore/schedule:seed"), {
          schoolId,
          entries: simpleSchedulePayload,
        })
      : [];

  const scheduleCompositeIds =
    compositeSchedulePayload.length > 0
      ? await client.mutation(
          mutationRef("modules/schoolCore/schedule:seedCompositeEntries"),
          {
            schoolId,
            entries: compositeSchedulePayload,
          },
        )
      : [];

  const directorId =
    staffIdByKey.get("placeholder_director") ?? staffIds[0];
  const adminId =
    staffIdByKey.get("placeholder_admin") ?? directorId;
  const facilitiesId =
    staffIdByKey.get("placeholder_facilities") ?? directorId;

  const existingIncidents = await client.query(
    queryRef("modules/ops/incidents:listOpen"),
    { schoolId },
  );
  const existingTasks = await client.query(
    queryRef("modules/ops/tasks:listBoard"),
    { schoolId },
  );

  const opsSeed = buildOpsSeed({
    schoolName,
    rooms,
    directorId,
    adminId,
    facilitiesId,
  });

  const incidentIdByTitle = new Map(existingIncidents.map((incident) => [incident.title, incident._id]));
  for (const incident of opsSeed.incidents) {
    if (incidentIdByTitle.has(incident.title)) {
      continue;
    }

    const incidentId = await client.mutation(
      mutationRef("modules/ops/incidents:createManual"),
      {
        schoolId,
        reportedByStaffId: incident.reportedByStaffId,
        category: incident.category,
        title: incident.title,
        description: incident.description,
        location: incident.location,
        severity: incident.severity,
      },
    );
    incidentIdByTitle.set(incident.title, incidentId);
  }

  const existingTaskTitles = new Set(existingTasks.map((task) => task.title));
  const tasksToCreate = opsSeed.tasks
    .filter((task) => !existingTaskTitles.has(task.title))
    .map((task) => ({
      source: task.relatedIncidentTitle ? "incident" : "manual",
      title: task.title,
      description: task.description,
      assigneeStaffId: task.assigneeStaffId,
      creatorStaffId: task.creatorStaffId,
      priority: task.priority,
      ...(task.relatedIncidentTitle && incidentIdByTitle.get(task.relatedIncidentTitle)
        ? { relatedIncidentId: incidentIdByTitle.get(task.relatedIncidentTitle) }
        : {}),
    }));

  if (tasksToCreate.length > 0) {
    await client.mutation(mutationRef("modules/ops/tasks:createBatch"), {
      schoolId,
      tasks: tasksToCreate,
    });
  }

  const refreshedTasks = await client.query(
    queryRef("modules/ops/tasks:listBoard"),
    { schoolId },
  );
  const seededIncidentIds = new Set(incidentIdByTitle.values());
  for (const task of refreshedTasks) {
    if (!task.relatedIncidentId || !seededIncidentIds.has(task.relatedIncidentId)) {
      continue;
    }

    await client.mutation(
      mutationRef("modules/ops/telegram:_setIncidentAssignmentState"),
      {
        incidentId: task.relatedIncidentId,
        assignmentStatus: "assigned",
        assignmentReason: "seeded_from_workbooks",
        linkedTaskId: task._id,
      },
    );
  }

  const [staffRows, classRows, roomRows, timeSlotRows, openIncidents, boardTasks] =
    await Promise.all([
      client.query(queryRef("modules/schoolCore/staff:listBySchool"), { schoolId }),
      client.query(queryRef("modules/schoolCore/classes:listActive"), { schoolId }),
      client.query(queryRef("modules/schoolCore/rooms:listActive"), { schoolId }),
      client.query(queryRef("modules/schoolCore/timeSlots:listBySchool"), { schoolId }),
      client.query(queryRef("modules/ops/incidents:listOpen"), { schoolId }),
      client.query(queryRef("modules/ops/tasks:listBoard"), { schoolId }),
    ]);

  const firstClassId = classRows[0]?._id;
  const firstClassMonday =
    firstClassId !== undefined
      ? await client.query(queryRef("modules/schoolCore/schedule:getClassDay"), {
          classId: firstClassId,
          weekday: 1,
        })
      : [];

  console.log(
    JSON.stringify(
      {
        schoolId,
        academicYear: workload.academicYear,
        counts: {
          staff: staffRows.length,
          loadProfiles: workload.loadProfiles.length,
          classes: classRows.length,
          rooms: roomRows.length,
          timeSlots: timeSlotRows.length,
          scheduleSimple: scheduleTemplateIds.length,
          scheduleComposite: scheduleCompositeIds.length,
          firstClassMondayEntries: firstClassMonday.length,
          incidents: openIncidents.length,
          tasks: boardTasks.length,
        },
        warnings: {
          unresolvedTeacherCells: schedule.warnings.unresolvedTeacherCells.slice(0, 20),
          ambiguousTeacherCells: schedule.warnings.ambiguousTeacherCells.slice(0, 20),
        },
      },
      null,
      2,
    ),
  );
}

await main();
