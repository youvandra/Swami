// Speech model for the hero equaliser. Every export is a pure function of time,
// so the hero can be recorded frame by frame from the page clock.

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

type Syllable = { t: number; a: number; d: number; f: number };
type Phrase = { s: number; e: number; syl: Syllable[] };

// Phrases of 1.6-2.8s, pauses of 0.2-0.5s, syllables at ~6/s. Seeded, loops after ~8 minutes.
const phrases: Phrase[] = [];
let PERIOD = 0;
{
  const r = rng(0x5eed);
  let t = 0;
  while (t < 480) {
    const p: Phrase = { s: t, e: t + 1.6 + r() * 1.2, syl: [] };
    let st = t + 0.03 + r() * 0.05;
    while (st < p.e - 0.08) {
      if (r() > 0.1) {
        const stressed = r() < 0.25;
        p.syl.push({ t: st, a: stressed ? 0.8 + r() * 0.2 : 0.35 + r() * 0.5, d: 0.07 + r() * 0.08, f: 0.12 + r() * 0.76 });
      }
      st += (1 / 6) * (0.7 + r() * 0.65);
    }
    phrases.push(p);
    t = p.e + 0.2 + r() * 0.3;
  }
  PERIOD = t;
}

// Voice level 0..1 at time t (s since voice start); u = spectral position 0..1, or -1 for broadband.
export function voice(t: number, u: number) {
  if (t <= 0) return 0;
  t %= PERIOD;
  let lo = 0;
  let hi = phrases.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (phrases[m].s <= t) lo = m;
    else hi = m - 1;
  }
  const p = phrases[lo];
  if (t < p.s || t > p.e) return 0;
  const env = smooth((t - p.s) / 0.08) * smooth((p.e - t) / 0.16);
  let v = 0;
  for (const s of p.syl) {
    const dt = t - s.t;
    if (dt < 0) break;
    if (dt > 0.7) continue;
    const a = dt < 0.04 ? Math.sin(((dt / 0.04) * Math.PI) / 2) ** 2 : Math.exp(-(dt - 0.04) / s.d);
    const spec = u < 0 ? 1 : 0.45 + 0.55 * Math.exp(-(((u - s.f) / 0.26) ** 2));
    v = Math.max(v, s.a * a * spec);
  }
  return env * Math.min(1, 0.1 + v);
}
