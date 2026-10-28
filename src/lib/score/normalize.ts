// Shared arithmetic for the scorers. Pure: no I/O, so every scorer runs under plain node in tests.

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Rescale to 0..1 within one set. A set with no spread maps to 1, since nothing in it ranks lower. */
export function minmax(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => (hi === lo ? 1 : (v - lo) / (hi - lo)));
}

/**
 * Fit for a set of results from one query. Raw affinity alone favours what everyone likes, so half the
 * weight goes to lift (seeded minus seedless affinity) relative to the biggest lift in the same query.
 * Lift only compares within a query, which is why it is never shown on its own.
 */
export function fits(rows: { affinity: number; baseline?: number }[]): number[] {
  const lifts = rows.map((r) => Math.max(0, r.affinity - (r.baseline ?? r.affinity)));
  const top = Math.max(0, ...lifts);
  return rows.map((r, i) => round2(clamp01(0.5 * clamp01(r.affinity) + 0.5 * (top > 0 ? lifts[i] / top : 0))));
}

/**
 * Where an affinity stands in the full list it came from: 1 at the top, falling evenly to 0 below the last.
 * Live seeded affinities bunch together (0.95 to 0.98 across a top 50), so the position carries the signal
 * and the raw value does not. Without a list, the affinity stands for itself.
 */
export function standing(affinity: number, field?: number[]): number {
  if (!field?.length) return clamp01(affinity);
  return 1 - field.filter((f) => f > affinity).length / field.length;
}

/** "4th", "21st" */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/** "A", "A and B", "A, B and C" */
export function listing(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
