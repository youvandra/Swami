// Sliding-window limit per key, in memory. One server process is the unit; behind several, each counts its own.

export function limiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    /** True when the call is allowed (and counted). */
    take(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
      return true;
    },
    /** Seconds until the next call is allowed. */
    retryAfter(key: string): number {
      const first = (hits.get(key) ?? [])[0];
      return first === undefined ? 0 : Math.max(1, Math.ceil((first + windowMs - now()) / 1000));
    },
  };
}
