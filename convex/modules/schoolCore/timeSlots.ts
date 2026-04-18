import type { Id } from "../../_generated/dataModel";
import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

import { timeSlotSeedItemValidator } from "../../lib/validators";

type UpsertManyArgs = {
  schoolId: Id<"schools">;
  timeSlots: Array<{
    weekday: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
  }>;
};

export const upsertMany = mutation({
  args: {
    schoolId: v.id("schools"),
    timeSlots: v.array(timeSlotSeedItemValidator),
  },
  handler: async (ctx, args: UpsertManyArgs) => {
    const ids: Id<"timeSlots">[] = [];
    for (const item of args.timeSlots) {
      const existing = await ctx.db
        .query("timeSlots")
        .withIndex("by_school_weekday_lesson", (q) =>
          q
            .eq("schoolId", args.schoolId)
            .eq("weekday", item.weekday)
            .eq("lessonNumber", item.lessonNumber),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, item);
        ids.push(existing._id);
      } else {
        ids.push(
          await ctx.db.insert("timeSlots", {
            schoolId: args.schoolId,
            ...item,
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
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("timeSlots")
      .withIndex("by_school_weekday_lesson", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});
