import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { roomSeedItemValidator } from "../../lib/validators";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;

type UpsertManyArgs = {
  schoolId: Id<"schools">;
  rooms: Array<{
    code: string;
    capacity?: number;
    active: boolean;
  }>;
};

type ListActiveArgs = {
  schoolId: Id<"schools">;
};

export const upsertMany = mutation({
  args: {
    schoolId: v.id("schools"),
    rooms: v.array(roomSeedItemValidator),
  },
  handler: async (ctx: MutationCtx, args: UpsertManyArgs) => {
    const ids: Id<"rooms">[] = [];
    for (const item of args.rooms) {
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_school_code", (q: any) =>
          q.eq("schoolId", args.schoolId).eq("code", item.code),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, item);
        ids.push(existing._id);
      } else {
        ids.push(
          await ctx.db.insert("rooms", {
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
    schoolId: v.id("schools"),
  },
  handler: async (ctx: QueryCtx, args: ListActiveArgs) => {
    const rows: Doc<"rooms">[] = await ctx.db
      .query("rooms")
      .withIndex("by_school_code", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    return rows.filter((row) => row.active);
  },
});
