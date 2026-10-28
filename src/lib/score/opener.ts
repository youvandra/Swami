// Opener ranking: who the headliner's fans love (fit) and who brings fans the headliner lacks (reach gain).

import type { OpenerRow } from "../agent/types.ts";
import type { HeatCell } from "../qloo/types.ts";
import { addedCrowd, hoodHeat, topAdded } from "./heat.ts";
import { clamp01, fits, listing, ordinal, round2 } from "./normalize.ts";

export const A = 0.6;
export const B = 0.4;
export const scoreOf = (fit: number, reachGain: number) => round2(clamp01(fit) ** A * clamp01(reachGain) ** B);

export type OpenerCandidate = {
  id: string;
  name: string;
  genre: string;
  /** Seeded affinity in the headliner's related list, globally. */
  affinity: number;
  baseline?: number;
  /** Same, with the city as signal; absent when the city query skipped this act. */
  cityAffinity?: number;
  cityBaseline?: number;
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
  headlinerHeat: HeatCell[];
  candidates: OpenerCandidate[];
  exclude?: string[];
};

export function rankOpeners({ headliner, headlinerHeat, candidates, exclude = [] }: RankInput): (OpenerRow & { id: string })[] {
  const skip = new Set(exclude.map((x) => x.toLowerCase()));
  const pool = candidates.filter((c) => !skip.has(c.name.toLowerCase()) && !skip.has(c.id));
  if (pool.length === 0) return [];

  const global = fits(pool.map((c) => ({ affinity: c.affinity, baseline: c.baseline })));
  const hasCity = pool.some((c) => c.cityAffinity !== undefined);
  const city = hasCity ? fits(pool.map((c) => ({ affinity: c.cityAffinity ?? c.affinity, baseline: c.cityBaseline ?? c.baseline }))) : global;

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
      const fit = round2(c.cityAffinity !== undefined ? 0.6 * city[i] + 0.4 * global[i] : global[i]);
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
