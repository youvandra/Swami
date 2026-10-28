// Tag ids Swami filters on. The place categories follow Qloo's urn:tag:category:place naming; check them with
// the tags endpoint before relying on them live (the probe script prints what it finds).

export const PLACE_TAG = {
  venue: "urn:tag:category:place:music_venue",
  bar: "urn:tag:category:place:bar",
  restaurant: "urn:tag:category:place:restaurant",
  recordShop: "urn:tag:category:place:record_store",
  cafe: "urn:tag:category:place:cafe",
} as const;

export const PARTNER_KINDS = [
  { kind: "Bar", tag: PLACE_TAG.bar },
  { kind: "Restaurant", tag: PLACE_TAG.restaurant },
  { kind: "Record shop", tag: PLACE_TAG.recordShop },
  { kind: "Café", tag: PLACE_TAG.cafe },
] as const;

export type PartnerKind = (typeof PARTNER_KINDS)[number]["kind"];

export const genreTag = (slug: string) => `urn:tag:genre:music:${slug}`;
