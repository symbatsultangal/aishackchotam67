import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { staffSeedMemberValidator } from "../../lib/validators";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;

type SeedArgs = {
  schoolId: Id<"schools">;
  staff: Array<{
    fullName: string;
    displayName: string;
    roles: Array<
      | "director"
      | "vice_principal"
      | "teacher"
      | "admin"
      | "facilities"
      | "kitchen"
    >;
    subjects: string[];
    grades: string[];
    qualifications: string[];
    telegramEnabled: boolean;
    dashboardAccess: boolean;
    isActive: boolean;
  }>;
};

type ListAssignableArgs = {
  schoolId: Id<"schools">;
  activeOnly?: boolean;
};

export const seed = mutation({
  args: {
    schoolId: v.id("schools"),
    staff: v.array(staffSeedMemberValidator),
  },
  handler: async (ctx: MutationCtx, args: SeedArgs) => {
    const insertedIds: Id<"staff">[] = [];
    for (const member of args.staff) {
      const existing = await ctx.db
        .query("staff")
        .withIndex("by_school_name", (q: any) =>
          q.eq("schoolId", args.schoolId).eq("fullName", member.fullName),
        )
        .unique();

      if (existing) {
        insertedIds.push(existing._id);
        continue;
      }

      const id = await ctx.db.insert("staff", {
        schoolId: args.schoolId,
        ...member,
      });
      insertedIds.push(id);
    }
    return insertedIds;
  },
});

export const listAssignable = query({
  args: {
    schoolId: v.id("schools"),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args: ListAssignableArgs) => {
    const rows: Doc<"staff">[] = await ctx.db
      .query("staff")
      .withIndex("by_school_role_active", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("isActive", args.activeOnly ?? true),
      )
      .collect();

    return rows.filter(
      (row) =>
        row.roles.includes("teacher") || row.roles.includes("facilities"),
    );
  },
});
