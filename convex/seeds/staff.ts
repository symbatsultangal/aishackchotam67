import { mutation } from "../_generated/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";

import { publicRef } from "../lib/functionRefs";
import { staffSeedMemberValidator } from "../lib/validators";

const seedStaffRef = publicRef<
  "mutation",
  {
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
  }
>("modules/schoolCore/staff:seed");

export const seedStaffBundle = mutation({
  args: {
    schoolId: v.id("schools"),
    staff: v.array(staffSeedMemberValidator),
  },
  handler: async (ctx, args) => {
    return ctx.runMutation(seedStaffRef, args);
  },
});
