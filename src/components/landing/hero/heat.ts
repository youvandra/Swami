// Crowd heat for the hero: the headliner's neighbourhoods stay warm while the opener's light up one after
// another. Every export is a pure function of time, so the hero can be recorded frame by frame from the page clock.

export const TAU = Math.PI * 2;

export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const hash = (a: number, b: number) => {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};

// u runs 0..1 across the page, v runs 0..1 from the stage edge up; r is a radius in page widths.
type Spot = { u: number; v: number; r: number; peak: number };

// The headliner's crowd: always there, never the brightest thing on screen.
const HOME: Spot[] = [
  { u: 0.5, v: 0.52, r: 0.06, peak: 0.5 },
  { u: 0.42, v: 0.78, r: 0.04, peak: 0.38 },
];

// The opener's crowd: new neighbourhoods that light up in turn, hold, and settle. They sit in the open sky
// above the audience and between the cards, where nothing covers them.
const ADDED: Spot[] = [
  { u: 0.34, v: 0.58, r: 0.05, peak: 1 },
  { u: 0.63, v: 0.62, r: 0.055, peak: 1 },
  { u: 0.06, v: 0.48, r: 0.05, peak: 0.95 },
  { u: 0.55, v: 0.88, r: 0.04, peak: 0.9 },
  { u: 0.95, v: 0.5, r: 0.05, peak: 0.95 },
];

export const CYCLE = 10; // seconds for every added neighbourhood to take its turn

/** 0..1 brightness of one added neighbourhood at time t: a quick rise, a hold, a slow fade. */
function envelope(t: number, i: number) {
  if (t <= 0) return 0;
  const p = (((t - (i * CYCLE) / ADDED.length) % CYCLE) + CYCLE) % CYCLE / CYCLE;
  return smooth(p / 0.1) * smooth((0.6 - p) / 0.3);
}

/** Heat at (u, v) in a band whose height is `aspect` page widths: the brightest spot wins. */
export function heatAt(t: number, u: number, v: number, aspect: number): number {
  let h = 0;
  const reach = (s: Spot) => {
    const du = u - s.u;
    const dv = (v - s.v) * aspect; // v in page widths, so a spot stays round
    return Math.exp(-(du * du + dv * dv) / (s.r * s.r));
  };
  for (const s of HOME) h = Math.max(h, s.peak * reach(s));
  for (let i = 0; i < ADDED.length; i++) {
    const e = envelope(t, i);
    if (e > 0) h = Math.max(h, ADDED[i].peak * e * reach(ADDED[i]));
  }
  return h;
}

/** The strongest added neighbourhood right now, 0..1; the chat card's mic glows with it. */
export function pulse(t: number) {
  let p = 0;
  for (let i = 0; i < ADDED.length; i++) p = Math.max(p, envelope(t, i));
  return p;
}
