import type { Id } from "../../_generated/dataModel";
import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

import {
  assessmentKindValidator,
  assessmentSeedEntryValidator,
} from "../../lib/validators";

type UpsertManyArgs = {
  schoolId: Id<"schools">;
  assessments: Array<{
    kind: "tjb" | "bjb";
    sourceSheet: string;
    sourceRowKey: string;
    subject: string;
    classId?: Id<"classes">;
    classCode?: string;
    gradeLabel?: string;
    scheduledDate?: string;
    lessonNumber?: number;
    timeLabel?: string;
    startTime?: string;
    endTime?: string;
    roomId?: Id<"rooms">;
    roomCode?: string;
    teacherName?: string;
    notes?: string;
    rawCellText?: string;
    active: boolean;
  }>;
};

function assessmentEntryWrite(
  entry: UpsertManyArgs["assessments"][number],
  schoolId: Id<"schools">,
) {
  return {
    schoolId,
    kind: entry.kind,
    sourceSheet: entry.sourceSheet,
    sourceRowKey: entry.sourceRowKey,
    subject: entry.subject,
    active: entry.active,
    ...(entry.classId !== undefined ? { classId: entry.classId } : {}),
    ...(entry.classCode !== undefined ? { classCode: entry.classCode } : {}),
    ...(entry.gradeLabel !== undefined ? { gradeLabel: entry.gradeLabel } : {}),
    ...(entry.scheduledDate !== undefined
      ? { scheduledDate: entry.scheduledDate }
      : {}),
    ...(entry.lessonNumber !== undefined ? { lessonNumber: entry.lessonNumber } : {}),
    ...(entry.timeLabel !== undefined ? { timeLabel: entry.timeLabel } : {}),
    ...(entry.startTime !== undefined ? { startTime: entry.startTime } : {}),
    ...(entry.endTime !== undefined ? { endTime: entry.endTime } : {}),
    ...(entry.roomId !== undefined ? { roomId: entry.roomId } : {}),
    ...(entry.roomCode !== undefined ? { roomCode: entry.roomCode } : {}),
    ...(entry.teacherName !== undefined ? { teacherName: entry.teacherName } : {}),
    ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
    ...(entry.rawCellText !== undefined ? { rawCellText: entry.rawCellText } : {}),
  };
}

export const upsertMany = mutation({
  args: {
    schoolId: v.id("schools"),
    assessments: v.array(assessmentSeedEntryValidator),
  },
  handler: async (ctx, args: UpsertManyArgs) => {
    const ids: Id<"assessmentEntries">[] = [];
    for (const entry of args.assessments) {
      const existing = await ctx.db
        .query("assessmentEntries")
        .withIndex("by_school_kind_sourceRowKey", (q) =>
          q
            .eq("schoolId", args.schoolId)
            .eq("kind", entry.kind)
            .eq("sourceRowKey", entry.sourceRowKey),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, assessmentEntryWrite(entry, args.schoolId));
        ids.push(existing._id);
      } else {
        ids.push(
          await ctx.db.insert("assessmentEntries", {
            ...assessmentEntryWrite(entry, args.schoolId),
          }),
        );
      }
    }
    return ids;
  },
});

export const listBySchool = query({
  args: {
    schoolId: v.id("schools"),
    kind: v.optional(assessmentKindValidator),
  },
  handler: async (ctx, args) => {
    const rows = args.kind
      ? await ctx.db
          .query("assessmentEntries")
          .withIndex("by_school_kind_scheduledDate", (q) =>
            q.eq("schoolId", args.schoolId).eq("kind", args.kind!),
          )
          .collect()
      : await ctx.db
          .query("assessmentEntries")
          .withIndex("by_school_kind_scheduledDate", (q) => q.eq("schoolId", args.schoolId))
          .collect();

    return rows.filter((row) => (args.kind ? row.kind === args.kind : true));
  },
});
