import { mutation } from "../_generated/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";

import { publicRef } from "../lib/functionRefs";
import { scheduleSeedEntryValidator } from "../lib/validators";

const seedScheduleRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    entries: Array<{
      classId: Id<"classes">;
      weekday: number;
      lessonNumber: number;
      subject: string;
      teacherId: Id<"staff">;
      roomId: Id<"rooms">;
    }>;
  }
>("modules/schoolCore/schedule:seed");

export const seedScheduleBundle = mutation({
  args: {
    schoolId: v.id("schools"),
    entries: v.array(scheduleSeedEntryValidator),
  },
  handler: async (ctx, args) => {
    return ctx.runMutation(seedScheduleRef, args);
  },
});
