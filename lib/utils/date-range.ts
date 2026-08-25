/**
 * Shared date-range logic for the analytics page.
 *
 * Deliberately NOT inside DateRangeFilter.tsx: that file is "use client", and
 * everything exported from a client module becomes a client reference, so a
 * Server Component importing it cannot actually call these ("Attempted to call
 * some() from the server but some is on the client"). Both the server page and
 * the client filter import from here instead.
 */

export const RANGE_OPTIONS = [
  { key: "7D", label: "7 days" },
  { key: "30D", label: "30 days" },
  { key: "90D", label: "90 days" },
  { key: "FY", label: "This FY" },
  { key: "ALL", label: "All time" }
] as const;

export type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

export const DEFAULT_RANGE: RangeKey = "90D";

export function isRangeKey(v: string | undefined): v is RangeKey {
  return !!v && RANGE_OPTIONS.some((r) => r.key === v);
}

/**
 * Resolve a range key to an ISO lower bound.
 * Indian financial year runs 1 April → 31 March.
 */
export function resolveRange(key: string): { since: string | null; label: string } {
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

  switch (key) {
    case "7D":
      return { since: days(7), label: "Last 7 days" };
    case "30D":
      return { since: days(30), label: "Last 30 days" };
    case "FY": {
      const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { since: new Date(Date.UTC(y, 3, 1)).toISOString(), label: `FY ${y}–${String(y + 1).slice(2)}` };
    }
    case "ALL":
      return { since: null, label: "All time" };
    case "90D":
    default:
      return { since: days(90), label: "Last 90 days" };
  }
}
