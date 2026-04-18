import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

import { ragChunkValidator } from "../../lib/validators";

const mutation: any = mutationGeneric;

export function chunkText(input: string, maxChars = 1200): string[] {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if (`${current}\n\n${paragraph}`.length <= maxChars) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

type SaveChunksArgs = {
  schoolId: Id<"schools">;
  documentId: Id<"ministryDocuments">;
  language: string;
  chunks: Array<{
    chunkIndex: number;
    text: string;
    embedding: number[];
    sectionRef?: string;
  }>;
};

export const saveChunks = mutation({
  args: {
    schoolId: v.id("schools"),
    documentId: v.id("ministryDocuments"),
    language: v.string(),
    chunks: v.array(ragChunkValidator),
  },
  handler: async (ctx: MutationCtx, args: SaveChunksArgs) => {
    const existing = await ctx.db
      .query("ministryChunks")
      .withIndex("by_document_chunkIndex", (q: any) => q.eq("documentId", args.documentId))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const ids: Id<"ministryChunks">[] = [];
    for (const chunk of args.chunks) {
      ids.push(
        await ctx.db.insert("ministryChunks", {
          schoolId: args.schoolId,
          documentId: args.documentId,
          language: args.language,
          ...chunk,
        }),
      );
    }
    return ids;
  },
});
