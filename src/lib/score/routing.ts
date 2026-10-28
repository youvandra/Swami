// Tour routing: cities ranked by fan affinity, then ordered into a drivable leg.

import type { RouteStop } from "../agent/types.ts";
import { haversine, type City } from "./cities.ts";
import { fits } from "./normalize.ts";

/** Road miles run longer than the great circle. */
export const ROAD_FACTOR = 1.2;

export const REGIONS: Record<string, string[]> = {
  Midwest: ["IL", "WI", "MN", "MI", "OH", "IN", "MO", "IA", "NE", "KS"],
  Northeast: ["NY", "MA", "PA", "RI", "CT", "NJ", "DC", "MD"],
  South: ["TX", "TN", "GA", "NC", "VA", "FL", "LA", "AL", "KY", "OK"],
  West: ["CA", "OR", "WA", "CO", "UT", "NV", "AZ", "NM", "ID"],
};

export type CityAffinity = { city: City; affinity: number; baseline?: number };

export type RouteInput = { cities: CityAffinity[]; anchor?: string; stops?: number; capacity: number };

export function routeTour({ cities, anchor, stops = 8, capacity }: RouteInput): RouteStop[] {
  if (cities.length === 0) return [];
  const fit = fits(cities.map((c) => ({ affinity: c.affinity, baseline: c.baseline })));
  const ranked = cities.map((c, i) => ({ ...c, fit: fit[i] })).sort((a, b) => b.fit - a.fit);
  const first = ranked.find((c) => c.city.name === anchor) ?? ranked[0];
  const chosen = [first, ...ranked.filter((c) => c !== first).slice(0, Math.max(0, stops - 1))];

  // nearest neighbour from the anchor
  const leg = [first];
  const left = chosen.slice(1);
  while (left.length) {
    const at = leg[leg.length - 1].city;
    left.sort((a, b) => haversine(at, a.city) - haversine(at, b.city));
    leg.push(left.shift()!);
  }

  const order = [...chosen].sort((a, b) => b.fit - a.fit);
  return leg.map((c, i) => ({
    city: c.city.name,
    region: c.city.region,
    affinity: c.fit,
    milesFromPrev: i === 0 ? 0 : Math.round(haversine(leg[i - 1].city, c.city) * ROAD_FACTOR),
    room: roomBand(capacity, c.fit),
    note: noteFor(i === 0, order.indexOf(c), order.length, c.fit),
  }));
}

const r100 = (n: number) => Math.max(100, Math.round(n / 100) * 100);
export function roomBand(capacity: number, fit: number): string {
  const mid = capacity * (0.55 + 0.6 * fit);
  return `${r100(mid * 0.85).toLocaleString("en-US")}–${r100(mid * 1.15).toLocaleString("en-US")}`;
}

function noteFor(isAnchor: boolean, rank: number, of: number, fit: number): string {
  if (isAnchor) return rank === 0 ? "Anchor date. Strongest market on the leg." : "Anchor date.";
  if (rank === 0) return "Strongest market on the leg. Worth a Saturday.";
  if (rank === 1) return "Second strongest. Worth a Saturday.";
  if (rank === of - 1 && of > 2) return "Weakest stop. Consider a smaller room.";
  if (fit < 0.5) return "Thin today. Pair with a strong local opener.";
  return "Steady; good for a weeknight.";
}

/** Cities in a named region, or every city when the region is unknown. */
export function inRegion(cities: City[], region?: string): City[] {
  const states = region ? REGIONS[Object.keys(REGIONS).find((r) => r.toLowerCase() === region.toLowerCase()) ?? ""] : undefined;
  return states ? cities.filter((c) => states.includes(c.region)) : cities;
}
