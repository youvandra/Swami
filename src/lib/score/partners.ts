// Co-promo partners: places the opener's fans already go, inside the neighbourhoods where the new crowd lives.

import type { Partner } from "../agent/types.ts";
import type { PartnerKind } from "../qloo/urns.ts";
import { fits } from "./normalize.ts";

export type PartnerCandidate = { name: string; kind: PartnerKind; hood?: string; affinity: number; baseline?: number };

const ANGLES: Record<PartnerKind, ((hood: string) => string)[]> = {
  Bar: [() => "Pre-show listening night with the opener's record on rotation; ticket link on table cards.", (h) => `Happy-hour wristband deal for ticket holders, posters across ${h}.`],
  "Record shop": [() => "In-store signed vinyl giveaway with every ticket bought through their promo link.", () => "Window poster and a staff-picks shelf for both acts."],
  Restaurant: [() => "Show-night combo: a meal and a drink with a ticket stub.", () => "Late-night deal after the show for anyone with a wristband."],
  Café: [() => "Flyers at the counter and a stamped card for a free coffee after the show.", (h) => `Morning-after coffee deal for wristbands, flyers for ${h} regulars.`],
};

export function rankPartners(places: PartnerCandidate[], hoods: string[], take = 6): Partner[] {
  const fit = fits(places.map((p) => ({ affinity: p.affinity, baseline: p.baseline })));
  const inside = (p: PartnerCandidate) => !hoods.length || (p.hood !== undefined && hoods.includes(p.hood));
  const seen: Partial<Record<PartnerKind, number>> = {};
  return places
    .map((p, i) => ({ p, fit: fit[i] }))
    .sort((a, b) => Number(inside(b.p)) - Number(inside(a.p)) || b.fit - a.fit)
    .slice(0, take)
    .map(({ p, fit }) => {
      const n = (seen[p.kind] = (seen[p.kind] ?? -1) + 1);
      const angles = ANGLES[p.kind];
      return { name: p.name, kind: p.kind, hood: p.hood ?? "", fit, angle: angles[n % angles.length](p.hood ?? "the neighbourhood") };
    });
}
