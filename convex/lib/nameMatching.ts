/**
 * Name-matching helpers for mapping free-form director transcripts to staff.
 *
 * Strategy (in order, first hit wins):
 *   exact    — case-insensitive equality on displayName or fullName
 *   fuzzy    — first-name prefix match on fullName, unique across the pool
 *   none     — no single match; return up to 3 closest candidates by
 *              Levenshtein distance so the UI can show a picker
 *
 * All comparisons are Unicode-lowercase aware so they work for Cyrillic.
 */

export type StaffLike = {
  _id: string;
  displayName: string;
  fullName: string;
};

export type NameMatchResult<T extends StaffLike> =
  | { confidence: "exact"; staff: T; candidates: T[] }
  | { confidence: "fuzzy"; staff: T; candidates: T[] }
  | { confidence: "none"; staff: null; candidates: T[] };

export function normalizeName(raw: string): string {
  return raw.trim().toLocaleLowerCase();
}

export function matchStaffByName<T extends StaffLike>(
  query: string,
  pool: T[],
): NameMatchResult<T> {
  const normalized = normalizeName(query);
  if (!normalized) {
    return { confidence: "none", staff: null, candidates: [] };
  }

  // Exact match on either name form.
  const exact = pool.find(
    (staff) =>
      normalizeName(staff.displayName) === normalized ||
      normalizeName(staff.fullName) === normalized,
  );
  if (exact) {
    return { confidence: "exact", staff: exact, candidates: [exact] };
  }

  // First-name prefix match: take the first token of the query and match
  // against fullName's first token. Also accept when the query is itself a
  // single-token first name and the pool has a unique fullName starting with
  // that token.
  const firstToken = normalized.split(/\s+/)[0];
  if (firstToken) {
    const prefixMatches = pool.filter((staff) => {
      const fullFirst = normalizeName(staff.fullName).split(/\s+/)[0];
      const displayFirst = normalizeName(staff.displayName).split(/\s+/)[0];
      return fullFirst === firstToken || displayFirst === firstToken;
    });
    if (prefixMatches.length === 1) {
      return {
        confidence: "fuzzy",
        staff: prefixMatches[0],
        candidates: prefixMatches,
      };
    }
    if (prefixMatches.length > 1) {
      return {
        confidence: "none",
        staff: null,
        candidates: prefixMatches.slice(0, 3),
      };
    }
  }

  // Fallback: rank by Levenshtein distance and return the top 3 if at least
  // one is reasonably close. "Reasonably close" = distance <= 3 OR <= 40% of
  // query length. Anything worse than that, we return an empty candidate list.
  const scored = pool
    .map((staff) => ({
      staff,
      distance: Math.min(
        levenshtein(normalized, normalizeName(staff.displayName)),
        levenshtein(normalized, normalizeName(staff.fullName)),
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const threshold = Math.max(3, Math.floor(normalized.length * 0.4));
  const closeEnough = scored.filter((entry) => entry.distance <= threshold);
  return {
    confidence: "none",
    staff: null,
    candidates: closeEnough.slice(0, 3).map((entry) => entry.staff),
  };
}

/**
 * Iterative Levenshtein distance with two rolling rows — O(n*m) time, O(min)
 * space. Good enough for staff lists of 20–100 members.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
