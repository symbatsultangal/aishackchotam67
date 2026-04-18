"use node";

import pdfParse from "pdf-parse";
import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { internalActionGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";
import { embedText } from "../../lib/ai/embeddings";
import { chunkText } from "./chunks";

const internalAction: any = internalActionGeneric;

const getDocumentRef = publicRef<
  "query",
  { documentId: Id<"ministryDocuments"> },
  Doc<"ministryDocuments"> | null
>("modules/rag/documents:_getDocument");

const saveChunksRef = publicRef<
  "mutation",
  {
    schoolId: Id<"schools">;
    documentId: Id<"ministryDocuments">;
    language: string;
    chunks: Array<{
      chunkIndex: number;
      text: string;
      sectionRef?: string;
      embedding: number[];
    }>;
  },
  Id<"ministryChunks">[]
>("modules/rag/chunks:saveChunks");

const setDocumentStatusRef = publicRef<
  "mutation",
  {
    documentId: Id<"ministryDocuments">;
    parseStatus: "uploaded" | "parsed" | "embedded" | "error";
  },
  Id<"ministryDocuments">
>("modules/rag/documents:_setDocumentStatus");

type ExtractDocumentArgs = {
  documentId: Id<"ministryDocuments">;
};

export const extractDocumentText = internalAction({
  args: {
    documentId: v.id("ministryDocuments"),
  },
  handler: async (ctx: ActionCtx, args: ExtractDocumentArgs) => {
    const document = await ctx.runQuery(getDocumentRef, {
      documentId: args.documentId,
    });
    if (!document) {
      throw new Error("Document not found");
    }

    const blob = await ctx.storage.get(document.storageId);
    if (!blob) {
      throw new Error("Document blob not found");
    }

    const mimeType = blob.type || "application/octet-stream";
    let rawText = "";

    if (mimeType.includes("pdf")) {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const parsed = await pdfParse(buffer);
      rawText = parsed.text;
    } else {
      rawText = await blob.text();
    }

    const chunks = chunkText(rawText).map((text, chunkIndex) => ({
      chunkIndex,
      text,
      sectionRef: undefined,
    }));

    const embeddedChunks: Array<{
      chunkIndex: number;
      text: string;
      sectionRef?: string;
      embedding: number[];
    }> = [];
    for (const chunk of chunks) {
      const embedding = await embedText(chunk.text);
      embeddedChunks.push({
        ...chunk,
        embedding: embedding.embedding,
      });
    }

    await ctx.runMutation(saveChunksRef, {
      schoolId: document.schoolId,
      documentId: document._id,
      language: document.language,
      chunks: embeddedChunks,
    });

    await ctx.runMutation(setDocumentStatusRef, {
      documentId: document._id,
      parseStatus: "embedded",
    });

    return {
      chunkCount: embeddedChunks.length,
    };
  },
});
