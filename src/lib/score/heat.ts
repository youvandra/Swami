// Neighbourhood heat: raw heatmap cells in, map-ready neighbourhoods and added crowd out.

import type { Hood } from "../agent/types.ts";
import type { HeatCell } from "../qloo/types.ts";
import { CITY_BOX, findCity } from "./cities.ts";
import { round2 } from "./normalize.ts";

/** How much of the headliner's own heat cancels the opener's in a cell. Shared with the map renderer. */
export const OVERLAP = 0.9;

/** Gains below this are what the overlap leaves behind, rather than a new crowd. */
const MIN_GAIN = 0.12;

export const addedCrowd = (headliner: number, opener: number) => Math.max(0, opener - OVERLAP * headliner);

/** Map frame in pixels, the same as src/lib/crowdmap.ts. */
const W = 460;
const H = 300;

/** Name a cell has, or a stable one from its position when the boundary carries no names. */
const keyOf = (c: HeatCell) => c.name ?? `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`;

/** Per-neighbourhood heat, each layer scaled so its hottest neighbourhood is 1. */
export function hoodHeat(cells: HeatCell[]): Map<string, { value: number; weight: number; lat: number; lng: number }> {
  const top = Math.max(0, ...cells.map((c) => c.affinity));
  const out = new Map<string, { value: number; weight: number; lat: number; lng: number }>();
  for (const c of cells) out.set(keyOf(c), { value: top > 0 ? c.affinity / top : 0, weight: c.popularity, lat: c.lat, lng: c.lng });
  return out;
}

/** Project lat/lng into the map frame: the city's known box, else the cells' own extent with a margin. */
export function projector(city: string, cells: { lat: number; lng: number }[]) {
  const known = CITY_BOX[findCity(city)?.name ?? city];
  let [n, s, w, e] = known ?? [-Infinity, Infinity, Infinity, -Infinity];
  if (!known) {
    for (const c of cells) {
      n = Math.max(n, c.lat);
      s = Math.min(s, c.lat);
      w = Math.min(w, c.lng);
      e = Math.max(e, c.lng);
    }
    const padY = (n - s || 0.05) * 0.18;
    const padX = (e - w || 0.05) * 0.18;
    [n, s, w, e] = [n + padY, s - padY, w - padX, e + padX];
  }
  return (p: { lat: number; lng: number }) => ({ x: Math.round(((p.lng - w) / (e - w)) * W), y: Math.round(((n - p.lat) / (n - s)) * H) });
}

/** Join two acts' cells into the map's neighbourhoods. Cells only one side has count as zero on the other. */
export function toHoods(city: string, headliner: HeatCell[], opener: HeatCell[]): Hood[] {
  const h = hoodHeat(headliner);
  const o = hoodHeat(opener);
  const names = new Set([...h.keys(), ...o.keys()]);
  const at = projector(city, [...h.values(), ...o.values()]);
  return [...names].map((name) => {
    const p = h.get(name) ?? o.get(name)!;
    return { name, ...at(p), headliner: round2(h.get(name)?.value ?? 0), opener: round2(o.get(name)?.value ?? 0) };
  });
}

/** Neighbourhoods ranked by added crowd, weighted by how many people go out there. */
export function topAdded(headliner: HeatCell[], opener: HeatCell[], n = 3): { name: string; gain: number }[] {
  const h = hoodHeat(headliner);
  const o = hoodHeat(opener);
  return [...o.entries()]
    .map(([name, v]) => ({ name, gain: v.weight * addedCrowd(h.get(name)?.value ?? 0, v.value) }))
    .filter((x) => x.gain > MIN_GAIN)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, n);
}

/** Neighbourhoods where an act is strongest. */
export function strongest(cells: HeatCell[], n = 2): string[] {
  return [...hoodHeat(cells).entries()]
    .sort((a, b) => b[1].value * b[1].weight - a[1].value * a[1].weight)
    .slice(0, n)
    .map(([name]) => name);
}
