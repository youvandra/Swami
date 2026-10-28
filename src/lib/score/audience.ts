// Audience: Qloo's relative demographics turned into shares a person can read.

import type { Audience } from "../agent/types.ts";
import type { AgeKey, Demographics } from "../qloo/types.ts";
import { round2 } from "./normalize.ts";

/** Who buys concert tickets, by band; the relative affinities are applied on top of this. Approximate. */
const BASE: { band: string; keys: AgeKey[]; share: number }[] = [
  { band: "18–24", keys: ["24_and_younger"], share: 0.2 },
  { band: "25–29", keys: ["25_to_29"], share: 0.18 },
  { band: "30–34", keys: ["30_to_34"], share: 0.17 },
  { band: "35–44", keys: ["35_to_44"], share: 0.2 },
  { band: "45+", keys: ["45_to_54", "55_and_older"], share: 0.25 },
];

export function shares(d: Demographics | null): number[] {
  const raw = BASE.map(({ keys, share }) => {
    const rel = keys.map((k) => d?.age[k]).filter((v): v is number => v !== undefined);
    const avg = rel.length ? rel.reduce((a, b) => a + b, 0) / rel.length : 0;
    return share * Math.max(0.05, 1 + avg);
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return fixSum(raw.map((v) => v / sum));
}

export function womenShare(d: Demographics | null): number {
  const f = 1 + (d?.gender.female ?? 0);
  const m = 1 + (d?.gender.male ?? 0);
  return round2(f / (f + m));
}

/** Round to 2 decimals and push the rounding error into the largest share, so a column sums to exactly 1. */
function fixSum(v: number[]): number[] {
  const r = v.map(round2);
  const err = round2(1 - r.reduce((a, b) => a + b, 0));
  if (err !== 0) {
    const i = r.indexOf(Math.max(...r));
    r[i] = round2(r[i] + err);
  }
  return r;
}

export function buildAudience(headliner: Demographics | null, opener: Demographics | null, traits: Audience["traits"]): Audience {
  const h = shares(headliner);
  const o = shares(opener);
  return {
    ages: BASE.map((b, i) => ({ band: b.band, headliner: h[i], opener: o[i] })),
    women: { headliner: womenShare(headliner), opener: womenShare(opener) },
    traits,
  };
}

/** Share under 30, for prose. */
export const under30 = (a: Audience, side: "headliner" | "opener") => round2(a.ages[0][side] + a.ages[1][side]);
