import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx, QueryCtx } from "../../_generated/server";
import { actionGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { publicRef } from "../../lib/functionRefs";
import { embedText } from "../../lib/ai/embeddings";

const action: any = actionGeneric;
const query: any = queryGeneric;

const loadChunksRef = publicRef<
  "query",
  { ids: Id<"ministryChunks">[] },
  Doc<"ministryChunks">[]
>("modules/rag/retrieval:_loadChunks");

type RetrieveContextArgs = {
  schoolId: Id<"schools">;
  queryText: string;
  language?: string;
  limit?: number;
};

type LoadChunksArgs = {
  ids: Id<"ministryChunks">[];
};

export const retrieveContext = action({
  args: {
    schoolId: v.id("schools"),
    queryText: v.string(),
    language: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args: RetrieveContextArgs) => {
    const embedded = await embedText(args.queryText);
    const matches = await ctx.vectorSearch("ministryChunks", "by_embedding", {
      vector: embedded.embedding,
      limit: args.limit ?? 5,
      filter: (q: any) =>
        args.language
          ? q.or(q.eq("schoolId", args.schoolId), q.eq("language", args.language))
          : q.eq("schoolId", args.schoolId),
    });

    const chunks = await ctx.runQuery(loadChunksRef, {
      ids: matches.map((match: any) => match._id),
    });

    return chunks.map((chunk: any, index: number) => ({
      ...chunk,
      score: matches[index]?._score ?? 0,
    }));
  },
});

export const _loadChunks = query({
  args: {
    ids: v.array(v.id("ministryChunks")),
  },
  handler: async (ctx: QueryCtx, args: LoadChunksArgs) => {
    const chunks: any[] = [];
    for (const id of args.ids) {
      const chunk = await ctx.db.get(id);
      if (chunk) {
        chunks.push(chunk);
      }
    }
    return chunks;
  },
});
