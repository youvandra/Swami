// Sponsors: brands the headliner's fans pick more than everyone else does.

import type { Sponsor } from "../agent/types.ts";
import { round2 } from "./normalize.ts";

export type BrandCandidate = { name: string; category: string; affinity: number; baseline?: number };

/**
 * Lift is seeded affinity over the brand's overall popularity. Live, most brands sit near 1 (fans like what
 * everyone likes), so anything clearly above it is worth a pitch, and only a strong lift is quoted as "N×".
 */
export const MIN_LIFT = 1.05;
const QUOTE_LIFT = 1.3;

const ACTIVATION: Record<string, string> = {
  Beverage: "A sampling bar at the merch table fits the room.",
  Headphones: "Offer a listening booth and a giveaway.",
  "Outdoor apparel": "A co-branded tour tee is the natural ask.",
  Mobility: "Valet bike parking on show night.",
};

export function rankSponsors(brands: BrandCandidate[], take = 5): Sponsor[] {
  const priced = brands.filter((b) => b.baseline !== undefined && b.baseline > 0);
  const top = Math.max(0, ...priced.map((b) => b.affinity));
  return priced
    .map((b) => ({ b, lift: b.affinity / b.baseline! }))
    .filter((x) => x.lift >= MIN_LIFT)
    .sort((a, b) => b.lift - a.lift)
    .slice(0, take)
    .map(({ b, lift }) => ({ b, lift, shown: lift >= QUOTE_LIFT ? Math.round(lift * 10) / 10 : Math.round(lift * 100) / 100 }))
    .map(({ b, shown: lift }) => ({
      brand: b.name,
      category: b.category,
      fit: round2(top > 0 ? b.affinity / top : 0),
      lift,
      pitch: `${lift >= QUOTE_LIFT ? `Fans are ${lift}× likelier than average to pick it.` : "Fans pick it more than its overall popularity predicts."} ${ACTIVATION[b.category] ?? "A branded moment on show night and a tracked promo link."}`,
    }));
}
