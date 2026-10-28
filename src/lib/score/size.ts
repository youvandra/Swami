// How big an act draws, from what Qloo gives: popularity is a percentile across all artists, so the top of the
// scale is where the difference lives (Taylor Swift 0.9998, Phoebe Bridgers 0.994, Big Thief 0.991, checked 29 Oct).

export type Size = "club" | "hall" | "arena";

export const sizeFromPopularity = (p: number | undefined): Size => ((p ?? 0) >= 0.999 ? "arena" : (p ?? 0) >= 0.993 ? "hall" : "club");

export const sizeFromCapacity = (cap: number): Size => (cap >= 12_000 ? "arena" : cap >= 3_000 ? "hall" : "club");

export const SIZE_LABEL: Record<Size, string> = { club: "club-size", hall: "theatre-size", arena: "stadium-size" };
