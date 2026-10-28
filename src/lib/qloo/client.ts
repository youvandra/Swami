/* eslint-disable @typescript-eslint/no-explicit-any -- raw Qloo JSON, mapped in toEntity / neighbourhoodCells */
// Live Qloo over HTTP. Ported from the Kinsong client (retries, 429 backoff, timeout). Shapes checked against
// the hackathon host on 29 Oct 2026 with scripts/probe-qloo.ts:
// - heatmap on urn:geohash answers in ~3s with a real 0..1 affinity per ~150 m cell. The urn:entity:locality
//   boundary names its cells but ships every polygon (4.6 MB for Chicago) and takes over 90s, so it is unusable.
// - seedless locality insights list a city's neighbourhoods with a point each; cells take the nearest name.
// - seeded locality insights come back with an empty query block: no affinity per city. Within one heatmap the
//   affinity is rescaled to 0..1, but affinity_rank is not, so its mean is what compares one city to another.
// - seedless insights carry no affinity, so popularity stands in as the baseline.
// - localities need a location filter to answer at all.

import { AGE_KEYS, ENTITY_URN, type Demographics, type Entity, type EntityType, type HeatCell, type HeatSignal, type InsightQuery, type QlooSource, type Tag } from "./types.ts";

const TIMEOUT_MS = 45_000;
const ATTEMPTS = 3;
/** The hackathon host answers "Rate limit exceeded" from about ten requests in flight, across all runs. */
const IN_FLIGHT = 6;
const gate = { active: 0, waiting: [] as (() => void)[] };

async function slot<T>(run: () => Promise<T>): Promise<T> {
  if (gate.active >= IN_FLIGHT) await new Promise<void>((r) => gate.waiting.push(r));
  gate.active++;
  try {
    return await run();
  } finally {
    gate.active--;
    gate.waiting.shift()?.();
  }
}

/** Read-through cache that outlives the process (the qloo_cache table). Optional. */
export interface PersistentCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, body: unknown, ttlDays: number): Promise<void>;
}

/** Process-wide stand-in for the qloo_cache table when there is no database: newest `max` bodies, kept for their TTL. */
export function memoryCache(max: number): PersistentCache {
  const rows = new Map<string, { body: unknown; until: number }>();
  return {
    async get(key) {
      const row = rows.get(key);
      if (!row || row.until < Date.now()) return undefined;
      rows.delete(key);
      rows.set(key, row);
      return row.body;
    },
    async set(key, body, ttlDays) {
      rows.delete(key);
      rows.set(key, { body, until: Date.now() + ttlDays * 86_400_000 });
      if (rows.size > max) rows.delete(rows.keys().next().value!);
    },
  };
}

const TYPE_BY_URN = Object.fromEntries(Object.entries(ENTITY_URN).map(([k, v]) => [v, k as EntityType]));

export class HttpQloo implements QlooSource {
  readonly mode = "live" as const;
  /** Network calls made, cache hits excluded; the run budget reads this. */
  calls = 0;
  private readonly memory = new Map<string, unknown>();
  /** One neighbourhood list per city, shared by the heat calls running at once. */
  private readonly hoodLists = new Map<string, Promise<NamedPoint[]>>();
  private readonly apiKey: string;
  private readonly base: string;
  private readonly persistent?: PersistentCache;
  /** Sees every raw response; the probe script records them. */
  tap?: (url: string, body: unknown, ms: number) => void;

  constructor(apiKey: string, base = "https://hackathon.api.qloo.com", persistent?: PersistentCache) {
    this.apiKey = apiKey;
    this.base = base;
    this.persistent = persistent;
  }

  private async get(path: string, params: Record<string, string>, ttlDays = 7): Promise<any> {
    const url = `${this.base}${path}?${new URLSearchParams(params)}`;
    if (this.memory.has(url)) return this.memory.get(url);
    const stored = await this.persistent?.get(url).catch(() => undefined);
    if (stored !== undefined) {
      this.memory.set(url, stored);
      return stored;
    }
    let lastError: unknown;
    // The hackathon server occasionally stalls on a cold query; a retry clears it.
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        this.calls++;
        const t0 = Date.now();
        const res = await slot(() => fetch(url, { headers: { "X-Api-Key": this.apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) }).then(async (r) => ({ status: r.status, ok: r.ok, text: await r.text() })));
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`Qloo ${res.status} on ${path}`);
          if (attempt < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new QlooError(res.status, path, res.text);
        const body = JSON.parse(res.text);
        this.tap?.(url, body, Date.now() - t0);
        this.memory.set(url, body);
        await this.persistent?.set(url, body, ttlDays).catch(() => undefined);
        return body;
      } catch (e) {
        if (e instanceof QlooError) throw e; // a 4xx will fail the same way again
        lastError = e;
      }
    }
    throw lastError;
  }

  async search(query: string, type: EntityType, take = 5): Promise<Entity[]> {
    const body = await this.get("/search", { query, types: ENTITY_URN[type], take: String(take) }, 30);
    return (body.results ?? []).map((r: any) => toEntity(r, type));
  }

  async insights(q: InsightQuery): Promise<Entity[]> {
    const params = filterParams(q);
    if (q.seeds.length) params["signal.interests.entities"] = q.seeds.join(",");
    params["feature.explainability"] = "true";
    params.take = String(q.take ?? 50);
    const body = await this.get("/v2/insights", params);
    return (body.results?.entities ?? []).map((r: any) => toEntity(r, q.type));
  }

  async baseline(q: InsightQuery, ids: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (ids.length === 0) return out;
    const body = await this.get("/v2/insights", { ...filterParams({ ...q, seeds: [], trending: false, ids }), take: String(ids.length) });
    for (const r of body.results?.entities ?? []) {
      // a seedless query has no affinity; how popular the entity is overall is the honest stand-in
      const a = num(r.query?.affinity) ?? num(r.popularity);
      if (a !== undefined) out.set(r.entity_id, a);
    }
    return out;
  }

  async heatmap(signal: HeatSignal, city: string): Promise<HeatCell[]> {
    const [body, hoods] = await Promise.all([this.get("/v2/insights", heatParams(signal, city)), this.neighbourhoods(city)]);
    return nameCells(body.results?.heatmap ?? [], hoods);
  }

  async cityLean(entity: string, city: string): Promise<{ affinity: number; baseline?: number } | undefined> {
    // the same request as the city's heatmap, so a crowd map after routing costs nothing
    const body = await this.get("/v2/insights", heatParams({ entity }, city));
    return leanOf(body.results?.heatmap ?? []);
  }

  private neighbourhoods(city: string): Promise<NamedPoint[]> {
    const key = city.trim().toLowerCase();
    let list = this.hoodLists.get(key);
    if (!list) {
      list = this.get("/v2/insights", { "filter.type": "urn:entity:locality", "filter.location.query": city, take: "50" }, 30).then((b) => neighbourhoodPoints(b.results?.entities ?? [], city));
      list.catch(() => this.hoodLists.delete(key));
      this.hoodLists.set(key, list);
    }
    return list;
  }

  async demographics(entityId: string): Promise<Demographics | null> {
    const body = await this.get("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": entityId });
    const row = body.results?.demographics?.[0]?.query;
    if (!row) return null;
    const age: Demographics["age"] = {};
    for (const k of AGE_KEYS) {
      const v = num(row.age?.[k]);
      if (v !== undefined) age[k] = v;
    }
    return { age, gender: { female: num(row.gender?.female), male: num(row.gender?.male) } };
  }

  async tags(query: string): Promise<Tag[]> {
    const body = await this.get("/v2/tags", { "filter.query": query }, 30);
    return (body.results?.tags ?? []).map((t: any) => ({ id: t.id ?? t.tag_id, name: String(t.name).trim(), type: t.type }));
  }
}

export class QlooError extends Error {
  readonly status: number;
  constructor(status: number, path: string, body: string) {
    super(`Qloo ${status} on ${path}: ${body.slice(0, 200)}`);
    this.status = status;
  }
}

function heatParams(signal: HeatSignal, city: string): Record<string, string> {
  const params: Record<string, string> = { "filter.type": "urn:heatmap", "filter.location.query": city, "output.heatmap.boundary": "urn:geohash" };
  if ("entity" in signal) params["signal.interests.entities"] = signal.entity;
  else params["signal.interests.tags"] = signal.tag;
  return params;
}

function filterParams(q: InsightQuery): Record<string, string> {
  const params: Record<string, string> = { "filter.type": ENTITY_URN[q.type] };
  if (q.city) params[q.type === "place" ? "filter.location.query" : "signal.location.query"] = q.city;
  if (q.tags?.length) params["filter.tags"] = q.tags.join(",");
  if (q.trending) params["bias.trends"] = "high";
  if (q.ids?.length) params["filter.results.entities"] = q.ids.join(",");
  return params;
}

export function toEntity(r: any, fallback: EntityType): Entity {
  const p = r.properties ?? {};
  const urn = (r.types ?? []).find((t: string) => TYPE_BY_URN[t]);
  const contributions: any[] | undefined = r.query?.explainability?.["signal.interests.entities"];
  return {
    id: r.entity_id ?? r.id,
    name: r.name,
    type: urn ? TYPE_BY_URN[urn] : fallback,
    popularity: num(r.popularity),
    affinity: num(r.query?.affinity),
    imageUrl: p.image?.url ?? p.images?.[0]?.url,
    explain: contributions ? Object.fromEntries(contributions.map((c) => [c.entity_id, c.score])) : undefined,
    tags: Array.isArray(r.tags) ? r.tags.map((t: any): Tag => ({ id: t.tag_id ?? t.id, name: String(t.name).trim(), type: t.type })) : undefined,
    lat: num(r.location?.lat ?? p.geocode?.latitude),
    lng: num(r.location?.lon ?? p.geocode?.longitude),
    hood: (typeof p.neighborhood === "string" ? p.neighborhood : undefined) ?? p.geocode?.name ?? undefined,
    capacity: num(p.capacity),
    detail: p.short_description ?? p.address ?? undefined,
  };
}

export type NamedPoint = { name: string; lat: number; lng: number };

const NOT_A_NEIGHBOURHOOD = new Set(["city", "town", "village", "county", "state", "country"]);

/** A city's neighbourhoods from a seedless locality query: drop the city itself, suburbs and admin areas. */
export function neighbourhoodPoints(entities: any[], city: string): NamedPoint[] {
  const c = city.trim().toLowerCase();
  const seen = new Set<string>();
  const out: NamedPoint[] = [];
  for (const e of entities) {
    const name = String(e.name ?? "").trim();
    const lat = num(e.location?.lat);
    const lng = num(e.location?.lon);
    if (!name || lat === undefined || lng === undefined || seen.has(name)) continue;
    if (name.toLowerCase() === c || NOT_A_NEIGHBOURHOOD.has(e.properties?.place) || /township|county/i.test(name)) continue;
    seen.add(name);
    out.push({ name, lat, lng });
  }
  return out;
}

/** How far a cell may sit from a neighbourhood's point and still take its name. */
const MAX_KM = 2.5;

/**
 * Give each geohash cell the nearest neighbourhood's name and fold the cells per name: affinity is the mean over
 * cells weighted by popularity (empty blocks and water barely count), popularity the plain mean.
 * The cell sits at the neighbourhood's point. Cells with no neighbourhood near them are dropped, and so are
 * neighbourhoods under `minCells`: one hot cell (an airport, a stadium) would otherwise top the city.
 */
export function nameCells(cells: any[], hoods: NamedPoint[], minCells = 5): HeatCell[] {
  const sums = new Map<string, { hood: NamedPoint; aw: number; w: number; a: number; p: number; n: number }>();
  for (const c of cells) {
    const lat = num(c.location?.latitude);
    const lng = num(c.location?.longitude);
    const affinity = num(c.query?.affinity);
    if (lat === undefined || lng === undefined || affinity === undefined) continue;
    let best: NamedPoint | undefined;
    let bestKm = MAX_KM;
    for (const h of hoods) {
      const km = distanceKm(lat, lng, h.lat, h.lng);
      if (km < bestKm) [best, bestKm] = [h, km];
    }
    if (!best) continue;
    const popularity = num(c.query?.popularity) ?? 0;
    const s = sums.get(best.name) ?? { hood: best, aw: 0, w: 0, a: 0, p: 0, n: 0 };
    s.aw += affinity * popularity;
    s.w += popularity;
    s.a += affinity;
    s.p += popularity;
    s.n++;
    sums.set(best.name, s);
  }
  return [...sums.values()].filter((s) => s.n >= minCells).map((s) => ({
    name: s.hood.name,
    lat: s.hood.lat,
    lng: s.hood.lng,
    affinity: round3(s.w > 0 ? s.aw / s.w : s.a / s.n),
    popularity: round3(s.p / s.n),
  }));
}

/**
 * A city's lean: affinity_rank averaged over its cells, weighted by popularity. The baseline is the middle of
 * the rank scale, read as a percentile (unverified: Qloo does not document affinity_rank).
 */
export function leanOf(cells: any[]): { affinity: number; baseline: number } | undefined {
  let sum = 0;
  let weight = 0;
  for (const c of cells) {
    const rank = num(c.query?.affinity_rank);
    const popularity = num(c.query?.popularity) ?? 0;
    if (rank === undefined) continue;
    sum += rank * popularity;
    weight += popularity;
  }
  return weight > 0 ? { affinity: round3(sum / weight), baseline: 0.5 } : undefined;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const kx = 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot((lng2 - lng1) * kx, (lat2 - lat1) * 110.57);
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
