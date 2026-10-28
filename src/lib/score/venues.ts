// Venues ranked by how much the headliner's fans already go there, with a size note against the show.

import type { Venue } from "../agent/types.ts";
import { fits } from "./normalize.ts";

export type VenueCandidate = { name: string; hood?: string; capacity?: number; tags: string[]; affinity: number; baseline?: number };

export function rankVenues(headliner: string, capacity: number, places: VenueCandidate[], take = 5): Venue[] {
  const fit = fits(places.map((p) => ({ affinity: p.affinity, baseline: p.baseline })));
  return places
    .map((p, i) => ({ p, fit: fit[i] }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, take)
    .map(({ p, fit }, i) => ({ name: p.name, hood: p.hood ?? "", capacity: p.capacity, fit, tags: p.tags.slice(0, 3), note: noteFor(headliner, capacity, p.capacity, i) }));
}

function noteFor(headliner: string, want: number, capacity: number | undefined, rank: number): string {
  const lead = rank === 0 ? `Fans of ${headliner} already go here more than anywhere else on the list. ` : "";
  if (!capacity) return `${lead}Capacity unknown; confirm it with the venue.`;
  const r = capacity / want;
  if (r > 1.8) return `${lead}Too large for this show. Keep it in mind for a bigger one.`;
  if (r > 1.25) return `${lead}Bigger room. Pick it if the opener adds the crowd the map shows.`;
  if (r < 0.75) return `${lead}Smaller room. Good for a second night or a warm-up date.`;
  return `${lead}The right size for current demand.`;
}
