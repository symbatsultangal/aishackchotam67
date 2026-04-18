import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;

type EnsureSchoolArgs = {
  name: string;
  timezone: string;
  locale: string;
};

export const ensureSchool = mutation({
  args: {
    name: v.string(),
    timezone: v.string(),
    locale: v.string(),
  },
  handler: async (ctx: MutationCtx, args: EnsureSchoolArgs) => {
    const schools: Doc<"schools">[] = await ctx.db.query("schools").collect();
    const existing = schools.find((school) => school.name === args.name) ?? null;

    if (existing) {
      return existing._id;
    }

    const schoolId: Id<"schools"> = await ctx.db.insert("schools", {
      name: args.name,
      timezone: args.timezone,
      locale: args.locale,
      active: true,
    });
    return schoolId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    return ctx.db.query("schools").collect();
  },
});
