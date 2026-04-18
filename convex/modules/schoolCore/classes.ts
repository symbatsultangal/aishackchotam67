import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { classSeedItemValidator } from "../../lib/validators";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;

type UpsertManyArgs = {
  schoolId: Id<"schools">;
  classes: Array<{
    code: string;
    grade: string;
    homeroomTeacherId?: Id<"staff">;
    active: boolean;
  }>;
};

type ListActiveArgs = {
  schoolId: Id<"schools">;
};

export const upsertMany = mutation({
  args: {
    schoolId: v.id("schools") as any,
    classes: v.array(classSeedItemValidator) as any,
  },
  handler: async (ctx: MutationCtx, args: UpsertManyArgs) => {
    const ids: Id<"classes">[] = [];
    for (const item of args.classes) {
      const existing = await ctx.db
        .query("classes")
        .withIndex("by_school_code", (q: any) =>
          q.eq("schoolId", args.schoolId).eq("code", item.code),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, item);
        ids.push(existing._id);
      } else {
        ids.push(
          await ctx.db.insert("classes", {
            schoolId: args.schoolId,
            ...item,
          }),
        );
      }
    }
    return ids;
  },
});

export const listActive = query({
  args: {
    schoolId: v.id("schools") as any,
  },
  handler: async (ctx: QueryCtx, args: ListActiveArgs) => {
    const rows: Doc<"classes">[] = await ctx.db
      .query("classes")
      .withIndex("by_school_code", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    return rows.filter((row) => row.active);
  },
});
