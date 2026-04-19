import type { Id } from "../_generated/dataModel";

type ScheduleRow = {
  classId: Id<"classes">;
  lessonNumber: number;
  teacherId: Id<"staff">;
  roomId: Id<"rooms">;
};

type OverrideRow = {
  classId: Id<"classes">;
  lessonNumber: number;
  substituteTeacherId: Id<"staff">;
  roomId: Id<"rooms">;
  status: string;
};

export type OccupancyMaps = {
  room: Map<string, { teacherId: Id<"staff">; classId: Id<"classes"> }>;
  teacher: Map<string, boolean>;
};

function roomKey(roomId: string, lesson: number): string {
  return `${roomId}:${lesson}`;
}

function teacherKey(teacherId: string, lesson: number): string {
  return `${teacherId}:${lesson}`;
}

export function buildOccupancyMaps(
  baseRows: ScheduleRow[],
  overrides: OverrideRow[],
): OccupancyMaps {
  const active = overrides.filter((o) => o.status !== "canceled");
  const room = new Map<string, { teacherId: Id<"staff">; classId: Id<"classes"> }>();
  const teacher = new Map<string, boolean>();

  for (const row of baseRows) {
    const overridden = active.find(
      (o) => o.classId === row.classId && o.lessonNumber === row.lessonNumber,
    );
    if (overridden) continue;
    room.set(roomKey(String(row.roomId), row.lessonNumber), {
      teacherId: row.teacherId,
      classId: row.classId,
    });
    teacher.set(teacherKey(String(row.teacherId), row.lessonNumber), true);
  }

  for (const o of active) {
    room.set(roomKey(String(o.roomId), o.lessonNumber), {
      teacherId: o.substituteTeacherId,
      classId: o.classId,
    });
    teacher.set(teacherKey(String(o.substituteTeacherId), o.lessonNumber), true);
  }

  return { room, teacher };
}

export function vacateTeacher(
  maps: OccupancyMaps,
  teacherId: Id<"staff">,
  slots: Array<{ lessonNumber: number; roomId: string }>,
): void {
  for (const slot of slots) {
    const entry = maps.room.get(roomKey(slot.roomId, slot.lessonNumber));
    if (entry && entry.teacherId === teacherId) {
      maps.room.delete(roomKey(slot.roomId, slot.lessonNumber));
    }
    maps.teacher.delete(teacherKey(String(teacherId), slot.lessonNumber));
  }
}

export type ConflictResult = {
  isFree: boolean;
  roomAvailable: boolean;
  conflictReasons: string[];
};

export function checkCandidateConflicts(
  maps: OccupancyMaps,
  candidateId: Id<"staff">,
  lessonSlots: Array<{ lessonNumber: number; roomId: string }>,
): ConflictResult {
  const reasons: string[] = [];

  const busyLessons = lessonSlots
    .filter((slot) => maps.teacher.get(teacherKey(String(candidateId), slot.lessonNumber)))
    .map((slot) => slot.lessonNumber);
  const isFree = busyLessons.length === 0;
  if (!isFree) {
    reasons.push(`Teaches lesson(s) ${busyLessons.join(", ")} already`);
  }

  const blockedLessons: number[] = [];
  for (const slot of lessonSlots) {
    const occupant = maps.room.get(roomKey(slot.roomId, slot.lessonNumber));
    if (occupant && occupant.teacherId !== candidateId) {
      blockedLessons.push(slot.lessonNumber);
    }
  }
  const roomAvailable = blockedLessons.length === 0;
  if (!roomAvailable) {
    reasons.push(`Room occupied during lesson(s) ${blockedLessons.join(", ")}`);
  }

  return { isFree, roomAvailable, conflictReasons: reasons };
}

export function previewOverrideConflicts(
  maps: OccupancyMaps,
  newTeacherId: Id<"staff">,
  lessonNumber: number,
  roomId: string,
): { ok: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  if (maps.teacher.get(teacherKey(String(newTeacherId), lessonNumber))) {
    conflicts.push(`Учитель уже занят на уроке ${lessonNumber}`);
  }

  const occupant = maps.room.get(roomKey(roomId, lessonNumber));
  if (occupant && occupant.teacherId !== newTeacherId) {
    conflicts.push(`Кабинет занят на уроке ${lessonNumber}`);
  }

  return { ok: conflicts.length === 0, conflicts };
}
