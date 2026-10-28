// Stand-in for Qloo in tests and offline dev. It answers from the hand-written fake graph, the same way the
// live interface does, so every tool runs unchanged on either source.

import type { FixtureGraph } from "../../../fixtures/fake/graph.ts";
import { AGE_KEYS, type Demographics, type Entity, type EntityType, type HeatCell, type HeatSignal, type InsightQuery, type QlooSource, type Tag } from "./types.ts";

/** Stable 0..1 from a string, so generated values never change between runs. */
export function unit(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (const c of s.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const sameCity = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export class FixtureQloo implements QlooSource {
  readonly mode = "fixture" as const;
  calls = 0;
  private readonly graph: FixtureGraph;
  private readonly byId: Map<string, Entity & { city?: string }>;

  constructor(graph: FixtureGraph) {
    this.graph = graph;
    this.byId = new Map(graph.entities.map((e) => [e.id, e]));
  }

  async search(query: string, type: EntityType, take = 5): Promise<Entity[]> {
    this.calls++;
    const words = query.toLowerCase().replace(/[^a-z0-9& ]/g, " ").split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return this.graph.entities
      .filter((e) => e.type === type && words.every((w) => e.name.toLowerCase().includes(w)))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, take);
  }

  async insights(q: InsightQuery): Promise<Entity[]> {
    this.calls++;
    const per = new Map<string, Record<string, number>>();
    for (const seed of q.seeds) {
      for (const [id, a] of Object.entries(this.graph.links[seed] ?? {})) {
        (per.get(id) ?? per.set(id, {}).get(id)!)[seed] = a;
      }
    }
    const out: Entity[] = [];
    for (const [id, bySeed] of per) {
      const e = this.byId.get(id);
      if (!e || e.type !== q.type || q.seeds.includes(id)) continue;
      if (q.type === "place" && q.city && !sameCity(e.city, q.city)) continue;
      if (q.tags?.length && !e.tags?.some((t) => q.tags!.includes(t.id))) continue;
      const total = Object.values(bySeed).reduce((a, b) => a + b, 0) / q.seeds.length;
      // A city leans the music a little, the way signal.location.query does live.
      const lean = q.city && q.type === "artist" ? (unit(`${q.city}:${id}`) - 0.5) * 0.1 : 0;
      const trend = q.trending && this.graph.trending.includes(id) ? 0.08 : 0;
      out.push({ ...e, affinity: round(Math.min(1, Math.max(0, total + lean + trend))), explain: Object.fromEntries(Object.keys(bySeed).map((k) => [k, round(1 / q.seeds.length)])) });
    }
    out.sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
    const top = out.slice(0, q.take ?? 50);
    return q.trending ? top.filter((e) => this.graph.trending.includes(e.id)) : top;
  }

  async baseline(_q: InsightQuery, ids: string[]): Promise<Map<string, number>> {
    this.calls++;
    const out = new Map<string, number>();
    for (const id of ids) {
      const e = this.byId.get(id);
      if (!e) continue;
      out.set(id, this.graph.baseline[id] ?? round((e.popularity ?? 0.3) * 0.7));
    }
    return out;
  }

  async heatmap(signal: HeatSignal, city: string): Promise<HeatCell[]> {
    this.calls++;
    const key = "entity" in signal ? signal.entity : signal.tag;
    const name = Object.keys(this.graph.hoods).find((c) => sameCity(c, city));
    if (!name) return [];
    const known = this.graph.heat[key];
    if (known && Object.keys(known).length === 0) return [];
    if (!known && !this.byId.has(key) && !key.startsWith("urn:tag:")) return [];
    const values = known?.[name];
    return this.graph.hoods[name].map((h) => ({
      lat: h.lat,
      lng: h.lng,
      name: h.name,
      affinity: values ? (values[h.name] ?? 0) : round(unit(`${key}:${name}:${h.name}`) ** 1.6),
      popularity: h.weight,
    }));
  }

  async demographics(entityId: string): Promise<Demographics | null> {
    this.calls++;
    const known = this.graph.demographics[entityId];
    if (known) return known;
    if (this.byId.get(entityId)?.type !== "artist") return null;
    const age: Demographics["age"] = {};
    AGE_KEYS.forEach((k, i) => (age[k] = round((unit(entityId, i) - 0.5) * 0.8 - (i - 2.5) * 0.08)));
    const female = round((unit(entityId, 9) - 0.5) * 0.5);
    return { age, gender: { female, male: -female } };
  }

  async tags(query: string): Promise<Tag[]> {
    this.calls++;
    const q = query.toLowerCase();
    const seen = new Map<string, Tag>();
    for (const e of this.graph.entities) for (const t of e.tags ?? []) if (t.name.toLowerCase().includes(q)) seen.set(t.id, t);
    return [...seen.values()];
  }
}
