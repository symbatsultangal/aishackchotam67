import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import {
  internalActionGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";

import { internalRef, publicRef } from "../../lib/functionRefs";
import { nowIsoString } from "../../lib/time";
import { documentParseStatusValidator } from "../../lib/validators";

const mutation: any = mutationGeneric;
const query: any = queryGeneric;
const internalAction: any = internalActionGeneric;

const extractDocumentTextRef = internalRef<
  "action",
  { documentId: Id<"ministryDocuments"> },
  { chunkCount: number }
>("modules/rag/documentExtraction:extractDocumentText");

const listPendingDocumentsRef = publicRef<
  "query",
  Record<string, never>,
  Doc<"ministryDocuments">[]
>("modules/rag/documents:_listPendingDocuments");

type RegisterUploadArgs = {
  schoolId: Id<"schools">;
  code: string;
  title: string;
  storageId: Id<"_storage">;
  language: string;
  version: string;
};

type GetDocumentStatusArgs = {
  schoolId: Id<"schools">;
};

type GetDocumentArgs = {
  documentId: Id<"ministryDocuments">;
};

type SetDocumentStatusArgs = {
  documentId: Id<"ministryDocuments">;
  parseStatus: "uploaded" | "parsed" | "embedded" | "error";
};

export const registerUpload = mutation({
  args: {
    schoolId: v.id("schools"),
    code: v.string(),
    title: v.string(),
    storageId: v.id("_storage"),
    language: v.string(),
    version: v.string(),
  },
  handler: async (ctx: MutationCtx, args: RegisterUploadArgs) => {
    const documentId = await ctx.db.insert("ministryDocuments", {
      ...args,
      uploadedAt: nowIsoString(),
      parseStatus: "uploaded",
    });

    await ctx.scheduler.runAfter(0, extractDocumentTextRef, {
      documentId,
    });

    return documentId;
  },
});

export const createUploadUrl = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    return ctx.storage.generateUploadUrl();
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("ministryDocuments"),
  },
  handler: async (ctx: MutationCtx, args: { documentId: Id<"ministryDocuments"> }) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    const chunks = await ctx.db
      .query("ministryChunks")
      .withIndex("by_document_chunkIndex", (q: any) => q.eq("documentId", args.documentId))
      .collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    await ctx.storage.delete(document.storageId);
    await ctx.db.delete(args.documentId);
    return args.documentId;
  },
});

export const getDocumentStatus = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx: QueryCtx, args: GetDocumentStatusArgs) => {
    return ctx.db
      .query("ministryDocuments")
      .withIndex("by_school_code_version", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

export const reindexPendingDocuments = internalAction({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const pending = await ctx.runQuery(listPendingDocumentsRef, {});
    for (const document of pending) {
      await ctx.scheduler.runAfter(0, extractDocumentTextRef, {
        documentId: document._id,
      });
    }
    return pending.length;
  },
});

export const _getDocument = query({
  args: {
    documentId: v.id("ministryDocuments"),
  },
  handler: async (ctx: QueryCtx, args: GetDocumentArgs) => ctx.db.get(args.documentId),
});

export const _listPendingDocuments = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const rows: Doc<"ministryDocuments">[] = await ctx.db
      .query("ministryDocuments")
      .collect();
    return rows.filter((row) => row.parseStatus !== "embedded");
  },
});

export const _setDocumentStatus = mutation({
  args: {
    documentId: v.id("ministryDocuments"),
    parseStatus: documentParseStatusValidator,
  },
  handler: async (ctx: MutationCtx, args: SetDocumentStatusArgs) => {
    await ctx.db.patch(args.documentId, { parseStatus: args.parseStatus });
    return args.documentId;
  },
});
