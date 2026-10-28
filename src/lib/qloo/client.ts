/* eslint-disable @typescript-eslint/no-explicit-any -- raw Qloo JSON, mapped in toEntity / toCell */
// Live Qloo over HTTP. Ported from the Kinsong client, which was exercised against the hackathon host:
// retries, the 429 backoff and the timeout are verified there. The heatmap, demographics and tag
// mappings are new and unverified until the probe script records real responses.

import { AGE_KEYS, ENTITY_URN, type Demographics, type Entity, type EntityType, type HeatCell, type HeatSignal, type InsightQuery, type QlooSource, type Tag } from "./types.ts";

const TIMEOUT_MS = 45_000;
const ATTEMPTS = 3;

/** Read-through cache that outlives the process (the qloo_cache table). Optional. */
export interface PersistentCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, body: unknown, ttlDays: number): Promise<void>;
}

const TYPE_BY_URN = Object.fromEntries(Object.entries(ENTITY_URN).map(([k, v]) => [v, k as EntityType]));

export class HttpQloo implements QlooSource {
  readonly mode = "live" as const;
  /** Network calls made, cache hits excluded; the run budget reads this. */
  calls = 0;
  private readonly memory = new Map<string, unknown>();
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
        const res = await fetch(url, { headers: { "X-Api-Key": this.apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`Qloo ${res.status} on ${path}`);
          if (attempt < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new QlooError(res.status, path, await res.text());
        const body = await res.json();
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
    const body = await this.get("/v2/insights", { ...filterParams({ ...q, trending: false }), "filter.results.entities": ids.join(","), take: String(ids.length) });
    for (const r of body.results?.entities ?? []) {
      const a = num(r.query?.affinity);
      if (a !== undefined) out.set(r.entity_id, a);
    }
    return out;
  }

  async heatmap(signal: HeatSignal, city: string): Promise<HeatCell[]> {
    const params: Record<string, string> = { "filter.type": "urn:heatmap", "filter.location.query": city, "output.heatmap.boundary": "neighborhood" };
    if ("entity" in signal) params["signal.interests.entities"] = signal.entity;
    else params["signal.interests.tags"] = signal.tag;
    const body = await this.get("/v2/insights", params);
    return (body.results?.heatmap ?? []).map(toCell).filter((c: HeatCell | null): c is HeatCell => c !== null);
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

function filterParams(q: InsightQuery): Record<string, string> {
  const params: Record<string, string> = { "filter.type": ENTITY_URN[q.type] };
  if (q.city) params[q.type === "place" ? "filter.location.query" : "signal.location.query"] = q.city;
  if (q.tags?.length) params["filter.tags"] = q.tags.join(",");
  if (q.trending) params["bias.trends"] = "high";
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
    hood: p.neighborhood ?? p.geocode?.neighborhood ?? undefined,
    capacity: num(p.capacity),
    detail: p.short_description ?? p.address ?? undefined,
  };
}

function toCell(r: any): HeatCell | null {
  const lat = num(r.location?.latitude ?? r.location?.lat);
  const lng = num(r.location?.longitude ?? r.location?.lon);
  const affinity = num(r.query?.affinity);
  if (lat === undefined || lng === undefined || affinity === undefined) return null;
  return { lat, lng, name: r.location?.name ?? r.location?.neighborhood, affinity, popularity: num(r.query?.popularity) ?? 1 };
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
