import { mutation } from "../_generated/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";

import { publicRef } from "../lib/functionRefs";

const registerUploadRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    code: string;
    title: string;
    storageId: Id<"_storage">;
    language: string;
    version: string;
  }
>("modules/rag/documents:registerUpload");

export const registerOrderBundle = mutation({
  args: {
    schoolId: v.id("schools"),
    code: v.string(),
    title: v.string(),
    storageId: v.id("_storage"),
    language: v.string(),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.runMutation(registerUploadRef, args);
  },
});
