// Dot-matrix city map shared by the landing page and the crowd_map artifact.
// Heat at a point is a sum of gaussian bumps centred on each neighbourhood.

import type { Hood } from "./agent/types";

export type Layer = "headliner" | "opener" | "gain";

export const MAP_COLS = 46;
export const MAP_ROWS = 30;
export const MAP_PITCH = 10;
export const MAP_W = MAP_COLS * MAP_PITCH;
export const MAP_H = MAP_ROWS * MAP_PITCH;

// Lakefront to the east, a ragged western edge, a narrowing south side.
const lakeEdge = (y: number) => 404 - 22 * Math.sin(y / 46) - y * 0.12;
const westEdge = (y: number) => 30 + 18 * Math.sin(y / 23) + (y > 150 ? (y - 150) * 0.55 : 0) + (y < 60 ? (60 - y) * 0.9 : 0);
const inCity = (x: number, y: number) => x > westEdge(y) && x < lakeEdge(y) && !(y < 34 && x > 300);

const RADIUS = 56;
function field(hoods: Hood[], key: "headliner" | "opener", x: number, y: number) {
  let v = 0;
  for (const h of hoods) v += h[key] * Math.exp(-((x - h.x) ** 2 + (y - h.y) ** 2) / (RADIUS * RADIUS));
  return Math.min(1, v);
}

export function heat(hoods: Hood[], layer: Layer, x: number, y: number) {
  const h = field(hoods, "headliner", x, y);
  const o = field(hoods, "opener", x, y);
  const v = layer === "headliner" ? h : layer === "opener" ? o : Math.max(0, o - h * 0.9);
  // rounded so server and client render identical attributes
  return Math.round(v * 100) / 100;
}

export type Dot = { x: number; y: number; size: number; fill: string };

export function buildDots(hoods: Hood[], layer: Layer): Dot[] {
  const out: Dot[] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const x = c * MAP_PITCH + MAP_PITCH / 2;
      const y = r * MAP_PITCH + MAP_PITCH / 2;
      if (!inCity(x, y)) continue;
      const v = heat(hoods, layer, x, y);
      const size = +(3.2 + v * 4.4).toFixed(2);
      out.push({ x: +(x - size / 2).toFixed(2), y: +(y - size / 2).toFixed(2), size, fill: colour(v) });
    }
  }
  return out;
}

// navy -> cyan -> near white, the hero's glow in miniature
export function colour(v: number, light = false) {
  const stops = light
    ? [
        [0, 222, 230, 234],
        [0.55, 47, 198, 220],
        [1, 14, 58, 69],
      ]
    : [
        [0, 31, 47, 62],
        [0.55, 70, 220, 236],
        [1, 232, 253, 255],
      ];
  const i = v > stops[1][0] ? 1 : 0;
  const a = stops[i];
  const b = stops[i + 1];
  const k = (v - a[0]) / (b[0] - a[0]);
  const m = (j: number) => Math.round(a[j] + (b[j] - a[j]) * k);
  return `rgb(${m(1)},${m(2)},${m(3)})`;
}

export const CHICAGO_HOODS: Hood[] = [
  { name: "Lincoln Park", x: 330, y: 70, headliner: 1, opener: 0 },
  { name: "Wicker Park", x: 262, y: 122, headliner: 0.75, opener: 0.45 },
  { name: "West Loop", x: 352, y: 165, headliner: 0.85, opener: 0 },
  { name: "Logan Square", x: 178, y: 92, headliner: 0, opener: 0.95 },
  { name: "Pilsen", x: 228, y: 214, headliner: 0, opener: 0.9 },
  { name: "Avondale", x: 140, y: 50, headliner: 0, opener: 0.6 },
  { name: "Hyde Park", x: 372, y: 262, headliner: 0, opener: 0.55 },
];
