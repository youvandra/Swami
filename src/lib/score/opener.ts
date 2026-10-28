// Opener ranking: who the headliner's fans love (fit) and who brings fans the headliner lacks (reach gain).

import type { OpenerRow } from "../agent/types.ts";
import type { HeatCell } from "../qloo/types.ts";
import { addedCrowd, hoodHeat, topAdded } from "./heat.ts";
import { clamp01, listing, ordinal, round2, standing } from "./normalize.ts";

export const A = 0.6;
export const B = 0.4;
export const scoreOf = (fit: number, reachGain: number) => round2(clamp01(fit) ** A * clamp01(reachGain) ** B);

export type OpenerCandidate = {
  id: string;
  name: string;
  genre: string;
  /** Seeded affinity in the headliner's related list, globally. */
  affinity: number;
  /** Same, with the city as signal; absent when the city query skipped this act. */
  cityAffinity?: number;
  /** Position in the headliner's related list (1-based), when the act was in it. */
  relatedRank?: number;
  relatedOf?: number;
  /** The act's own heat, or its scene's when `estimated`. */
  heat: HeatCell[];
  estimated: boolean;
  rising: boolean;
  onRoster: boolean;
};

export type RankInput = {
  headliner: string;
  /** Affinities of the headliner's whole related list, and of its city-signal list, that the pool came from. */
  field?: { related: number[]; city?: number[] };
  headlinerHeat: HeatCell[];
  candidates: OpenerCandidate[];
  exclude?: string[];
};

/**
 * Fit is where the act stands in the headliner's related list. There is no lift term: live, seedless queries carry
 * no affinity, so the only baseline is popularity, and "seeded minus popularity" just marks acts as less famous.
 * Weighted in at all, it moved the act the fans rank 1st below the one they rank 7th. Qloo's order already
 * corrects for popularity, and reach gain is what rewards bringing someone else's crowd.
 */
const fitsOf = (affinities: number[], field?: number[]) => affinities.map((a) => standing(a, field));

export function rankOpeners({ headliner, headlinerHeat, candidates, field, exclude = [] }: RankInput): (OpenerRow & { id: string })[] {
  const skip = new Set(exclude.map((x) => x.toLowerCase()));
  const pool = candidates.filter((c) => !skip.has(c.name.toLowerCase()) && !skip.has(c.id));
  if (pool.length === 0) return [];

  const global = fitsOf(pool.map((c) => c.affinity), field?.related);
  const hasCity = pool.some((c) => c.cityAffinity !== undefined);
  const city = hasCity ? fitsOf(pool.map((c) => c.cityAffinity ?? c.affinity), field?.city ?? field?.related) : global;

  const head = hoodHeat(headlinerHeat);
  const raw = pool.map((c) => {
    let gain = 0;
    let total = 0;
    for (const [name, o] of hoodHeat(c.heat)) {
      gain += o.weight * addedCrowd(head.get(name)?.value ?? 0, o.value);
      total += o.weight * o.value;
    }
    return { gain, share: total > 0 ? gain / total : 0 };
  });
  const maxGain = Math.max(0, ...raw.map((r) => r.gain));

  return pool
    .map((c, i) => {
      const fit = round2(clamp01(c.cityAffinity !== undefined ? 0.6 * city[i] + 0.4 * global[i] : global[i]));
      // Half "how much of this act's crowd is new", half "how big that new crowd is next to the others".
      const reachGain = round2(0.5 * raw[i].share + 0.5 * (maxGain > 0 ? raw[i].gain / maxGain : 0));
      const hoods = topAdded(headlinerHeat, c.heat, 2).map((h) => h.name);
      return { id: c.id, name: c.name, genre: c.genre, fit, reachGain, score: scoreOf(fit, reachGain), why: whyOf(headliner, c, hoods, reachGain), hoods, onRoster: c.onRoster, rising: c.rising, estimated: c.estimated };
    })
    .sort((a, b) => b.score - a.score || b.fit - a.fit || a.name.localeCompare(b.name));
}

/** The explanation is built from the same facts as the score, so it can never claim more than the numbers. */
function whyOf(headliner: string, c: OpenerCandidate, hoods: string[], reachGain: number): string {
  const taste = c.relatedRank ? `Ranks ${ordinal(c.relatedRank)} of ${c.relatedOf} among acts ${headliner}'s fans love` : `Sits outside ${headliner}'s closest matches`;
  const reach = hoods.length ? (reachGain >= 0.5 ? `, and owns ${listing(hoods)}, where ${headliner} runs cold.` : `, with some new crowd in ${listing(hoods)}.`) : `; its fans mostly live where ${headliner} already sells.`;
  const est = c.estimated ? " Its own data is thin, so the heat is estimated from its scene." : "";
  return `${taste}${reach}${est}`;
}
