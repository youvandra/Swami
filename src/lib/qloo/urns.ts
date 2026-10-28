// Tag ids Swami filters on, checked against the tags endpoint on 29 Oct 2026. Venues have no category tag;
// the "music venue" setting tag is the one that returns concert rooms.

export const PLACE_TAG = {
  venue: "urn:tag:setting:qloo:music_venue",
  bar: "urn:tag:category:place:bar",
  restaurant: "urn:tag:category:place:restaurant",
  recordShop: "urn:tag:category:place:record_store",
  cafe: "urn:tag:category:place:cafe",
} as const;

// Venue tags to try in order, by the size of the act, until a city answers. Outside the US "music venue" is often
// untagged (Jakarta returns none) while concert halls, live-music venues and stadiums are. Probed 29 Oct 2026.
export type VenueTag = { id: string; plural: string };
const VT = (slug: string, plural: string): VenueTag => ({ id: `urn:tag:category:place:${slug}`, plural });
const MUSIC_VENUE: VenueTag = { id: PLACE_TAG.venue, plural: "music venues" };
export const VENUE_LADDER: Record<"club" | "hall" | "arena", VenueTag[]> = {
  club: [MUSIC_VENUE, VT("live_music_venue", "live-music venues"), VT("concert_hall", "concert halls"), VT("live_music_bar", "live-music bars"), VT("night_club", "nightclubs")],
  hall: [VT("concert_hall", "concert halls"), VT("amphitheater", "amphitheatres"), MUSIC_VENUE, VT("live_music_venue", "live-music venues"), VT("arena", "arenas")],
  arena: [VT("stadium", "stadiums"), VT("arena", "arenas"), VT("amphitheater", "amphitheatres"), VT("concert_hall", "concert halls")],
};

export const PARTNER_KINDS = [
  { kind: "Bar", tag: PLACE_TAG.bar },
  { kind: "Restaurant", tag: PLACE_TAG.restaurant },
  { kind: "Record shop", tag: PLACE_TAG.recordShop },
  { kind: "Café", tag: PLACE_TAG.cafe },
] as const;

export type PartnerKind = (typeof PARTNER_KINDS)[number]["kind"];

export const genreTag = (slug: string) => `urn:tag:genre:music:${slug}`;
