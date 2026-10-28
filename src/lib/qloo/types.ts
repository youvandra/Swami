// The slice of Qloo that Swami uses, behind one interface so the live API and the fake fixture are interchangeable.
// Shapes marked "unverified" follow Qloo's docs and have yet to be checked against a live response.

export type EntityType = "artist" | "place" | "brand" | "locality";

export const ENTITY_URN: Record<EntityType, string> = {
  artist: "urn:entity:artist",
  place: "urn:entity:place",
  brand: "urn:entity:brand",
  locality: "urn:entity:locality",
};

export type Tag = { id: string; name: string; type?: string };

export type Entity = {
  id: string;
  name: string;
  type: EntityType;
  /** Qloo popularity percentile, 0..1. */
  popularity?: number;
  /** Affinity to the query signals, 0..1. */
  affinity?: number;
  imageUrl?: string;
  /** Seed entity id -> contribution 0..1, from feature.explainability. */
  explain?: Record<string, number>;
  tags?: Tag[];
  lat?: number;
  lng?: number;
  /** Places: neighbourhood or locality name when Qloo has one. */
  hood?: string;
  /** Places: venue capacity when Qloo has one. Unverified; often missing. */
  capacity?: number;
  /** Short description line (artist bio, place address). */
  detail?: string;
};

/** One heatmap cell. Unverified: neighbourhood names may be absent at geohash boundaries. */
export type HeatCell = { lat: number; lng: number; name?: string; affinity: number; popularity: number };

export const AGE_KEYS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;
export type AgeKey = (typeof AGE_KEYS)[number];

/** Relative affinity per bucket, -1..1, against the general population. Unverified shape. */
export type Demographics = { age: Partial<Record<AgeKey, number>>; gender: { female?: number; male?: number } };

export type InsightQuery = {
  type: EntityType;
  /** Seed entity ids (signal.interests.entities). */
  seeds: string[];
  /** Free-text city; restricts places (filter.location.query) and biases the rest (signal.location.query). */
  city?: string;
  /** Tag ids the results must carry (filter.tags). */
  tags?: string[];
  /** bias.trends=high: lean toward what is rising. */
  trending?: boolean;
  /** Only these ids (filter.results.entities): seeded affinity for acts outside the top list. */
  ids?: string[];
  take?: number;
};

export type HeatSignal = { entity: string } | { tag: string };

export interface QlooSource {
  readonly mode: "live" | "fixture";
  search(query: string, type: EntityType, take?: number): Promise<Entity[]>;
  insights(q: InsightQuery): Promise<Entity[]>;
  /** Seedless affinity for the given ids under the same filters as `q`; the gap to seeded affinity is the lift. */
  baseline(q: InsightQuery, ids: string[]): Promise<Map<string, number>>;
  heatmap(signal: HeatSignal, city: string): Promise<HeatCell[]>;
  /** How far a city as a whole leans toward the entity, comparable across cities; undefined when Qloo has no heat there. */
  cityLean(entity: string, city: string): Promise<{ affinity: number; baseline?: number } | undefined>;
  demographics(entityId: string): Promise<Demographics | null>;
  tags(query: string): Promise<Tag[]>;
}

/** Genre from the first music genre tag, the way the ranking shows it. */
export function genreOf(e: Entity): string | undefined {
  const t = e.tags?.find((t) => t.id.startsWith("urn:tag:genre:music"));
  return t?.name;
}
