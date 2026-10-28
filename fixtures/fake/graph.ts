// FAKE DATA. Hand-written stand-in for Qloo so the app runs without a key. Every artist, place, brand and
// number below is invented; none of it came from Qloo. The live API replaces all of it when QLOO_API_KEY is set.

import { CITY_BOX } from "../../src/lib/score/cities.ts";
import type { Demographics, Entity, Tag } from "../../src/lib/qloo/types.ts";
import { PLACE_TAG, genreTag } from "../../src/lib/qloo/urns.ts";

export type FixtureHood = { name: string; lat: number; lng: number; weight: number };

export type FixtureGraph = {
  entities: (Entity & { city?: string })[];
  /** seed id -> related id -> seeded affinity */
  links: Record<string, Record<string, number>>;
  /** id -> seedless affinity */
  baseline: Record<string, number>;
  /** ids that bias.trends=high lifts */
  trending: string[];
  /** neighbourhoods per city */
  hoods: Record<string, FixtureHood[]>;
  /** entity or tag id -> city -> hood name -> heat 0..1; missing cities are generated from a hash */
  heat: Record<string, Record<string, Record<string, number>>>;
  demographics: Record<string, Demographics>;
};

// Chicago hoods are placed in map pixels on the landing map's frame, then turned into lat/lng with the same frame,
// so the projection puts them back exactly where the hand-drawn map expects them.
const [N, S, W, E] = CITY_BOX.Chicago;
const px = (x: number, y: number) => ({ lat: +(N - (y / 300) * (N - S)).toFixed(5), lng: +(W + (x / 460) * (E - W)).toFixed(5) });

const tag = (slug: string, name: string): Tag => ({ id: genreTag(slug), name, type: "urn:tag:genre:music" });
const place = (slug: keyof typeof PLACE_TAG, name: string): Tag => ({ id: PLACE_TAG[slug], name, type: "urn:tag:category:place" });
const label = (name: string): Tag => ({ id: `urn:tag:keyword:${name.toLowerCase().replace(/\W+/g, "_")}`, name, type: "urn:tag:keyword" });

const artist = (id: string, name: string, popularity: number, tags: Tag[], detail: string): Entity => ({ id, name, type: "artist", popularity, tags, detail });

const ARTISTS: Entity[] = [
  artist("fa-marlow-vane", "Marlow Vane", 0.78, [tag("indie_folk", "Indie folk"), tag("indie_rock", "Indie rock")], "Indie folk band, four albums"),
  artist("fa-marlow-tide", "Marlow & the Tide", 0.69, [tag("americana", "Americana")], "Americana duo"),
  artist("fa-saint-rook", "Saint Rook", 0.72, [tag("alt_pop", "Alt pop")], "Alt pop singer"),
  artist("fa-halcyon-drive", "Halcyon Drive", 0.41, [tag("indie_rock", "Indie rock")], "Indie rock four-piece"),
  artist("fa-low-orchard", "The Low Orchard", 0.47, [tag("folk_pop", "Folk pop")], "Folk pop trio"),
  artist("fa-pia-marsh", "Pia Marsh", 0.36, [tag("alt_rnb", "Alt R&B")], "Alt R&B singer"),
  artist("fa-copper-hours", "Copper Hours", 0.12, [tag("garage", "Garage")], "Garage rock band"),
  artist("fa-june-atlas", "June Atlas", 0.55, [tag("dream_pop", "Dream pop")], "Dream pop duo"),
  artist("fa-fieldwork", "Fieldwork", 0.1, [tag("post_punk", "Post-punk")], "Post-punk band"),
  artist("fa-glass-meridian", "Glass Meridian", 0.3, [tag("synth_pop", "Synth pop")], "Synth pop act"),
  artist("fa-velvet-static", "Velvet Static", 0.66, [tag("shoegaze", "Shoegaze")], "Shoegaze band"),
  artist("fa-orla-crane", "Orla Crane", 0.33, [tag("singer_songwriter", "Singer-songwriter")], "Singer-songwriter"),
];

const venue = (id: string, name: string, hood: string, capacity: number, extra: string[]): Entity & { city: string } => ({
  id,
  name,
  type: "place",
  city: "Chicago",
  hood,
  capacity,
  tags: [place("venue", "Music venue"), ...extra.map(label)],
});

const VENUES = [
  venue("fp-thalia", "The Thalia Room", "Wicker Park", 1100, ["Standing", "Bar on site", "L train"]),
  venue("fp-copperline", "Copperline Hall", "West Loop", 1500, ["Seated balcony", "Late curfew"]),
  venue("fp-lantern", "Lantern Works", "Logan Square", 650, ["Standing", "All ages"]),
  venue("fp-greyhound", "The Greyhound", "Pilsen", 900, ["Standing", "Food hall next door"]),
  venue("fp-riverside", "Riverside Assembly", "Near North", 2200, ["Seated", "Premium bar"]),
];

const spot = (id: string, name: string, kind: keyof typeof PLACE_TAG, kindName: string, hood: string, extra: string[] = []): Entity & { city: string } => ({
  id,
  name,
  type: "place",
  city: "Chicago",
  hood,
  tags: [place(kind, kindName), ...extra.map(label)],
});

const PARTNERS = [
  spot("fp-two-moons", "Two Moons Bar", "bar", "Bar", "Logan Square", ["Listening bar"]),
  spot("fp-sola", "Sola Records", "recordShop", "Record shop", "Logan Square", ["Vinyl"]),
  spot("fp-calle", "Calle Taqueria", "restaurant", "Restaurant", "Pilsen", ["Taqueria"]),
  spot("fp-ninth", "Ninth Street Vinyl", "recordShop", "Record shop", "Pilsen", ["Vinyl"]),
  spot("fp-hollow-pine", "Hollow Pine Coffee", "cafe", "Café", "Avondale", ["Coffee"]),
  spot("fp-ember", "Little Ember Pizza", "restaurant", "Restaurant", "Avondale", ["Late pizza"]),
  spot("fp-gold-coast", "Gilt Wine Bar", "bar", "Bar", "Lincoln Park", ["Wine bar"]),
  spot("fp-bistro", "Maple Bistro", "restaurant", "Restaurant", "West Loop", ["Bistro"]),
];

const brand = (id: string, name: string, category: string): Entity => ({ id, name, type: "brand", tags: [{ id: `urn:tag:category:brand:${category.toLowerCase().replace(/\W+/g, "_")}`, name: category, type: "urn:tag:category:brand" }] });

const BRANDS = [
  brand("fb-northwind", "Northwind Cold Brew", "Beverage"),
  brand("fb-fieldline", "Fieldline Outfitters", "Outdoor apparel"),
  brand("fb-lumen", "Lumen Audio", "Headphones"),
  brand("fb-halo", "Halo Seltzer", "Beverage"),
  brand("fb-tidewater", "Tidewater Bikes", "Mobility"),
  brand("fb-bigcola", "Big Fizz Cola", "Beverage"),
  brand("fb-megamart", "Megamart", "Retail"),
];

const LOCALITY_AFFINITY: Record<string, number> = {
  Chicago: 0.94, Milwaukee: 0.81, Minneapolis: 0.88, "Kansas City": 0.62, "St. Louis": 0.7, Indianapolis: 0.58, Columbus: 0.76, Detroit: 0.84,
  Madison: 0.79, Cleveland: 0.66, "Grand Rapids": 0.6, Omaha: 0.52, "Des Moines": 0.5,
  Brooklyn: 0.86, Boston: 0.8, Philadelphia: 0.72, Washington: 0.7, Pittsburgh: 0.63,
  Seattle: 0.83, Portland: 0.85, "San Francisco": 0.74, Oakland: 0.71, "Los Angeles": 0.69, Denver: 0.77, "Salt Lake City": 0.55,
  Austin: 0.78, Dallas: 0.55, Houston: 0.5, Nashville: 0.68, Atlanta: 0.6, Asheville: 0.73, Raleigh: 0.62, "New Orleans": 0.58,
};
const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "-");
const LOCALITIES: Entity[] = Object.keys(LOCALITY_AFFINITY).map((name) => ({ id: `fl-${slug(name)}`, name, type: "locality" }));

const CHICAGO: FixtureHood[] = [
  { name: "Lincoln Park", ...px(330, 70), weight: 0.9 },
  { name: "Wicker Park", ...px(262, 122), weight: 0.85 },
  { name: "West Loop", ...px(352, 165), weight: 0.8 },
  { name: "Logan Square", ...px(178, 92), weight: 0.8 },
  { name: "Pilsen", ...px(228, 214), weight: 0.7 },
  { name: "Avondale", ...px(140, 50), weight: 0.6 },
  { name: "Hyde Park", ...px(372, 262), weight: 0.6 },
];

const AUSTIN: FixtureHood[] = [
  { name: "East Austin", lat: 30.265, lng: -97.715, weight: 0.85 },
  { name: "South Congress", lat: 30.245, lng: -97.75, weight: 0.8 },
  { name: "Hyde Park", lat: 30.305, lng: -97.73, weight: 0.6 },
  { name: "Downtown", lat: 30.268, lng: -97.743, weight: 0.9 },
  { name: "Mueller", lat: 30.298, lng: -97.705, weight: 0.55 },
  { name: "Zilker", lat: 30.26, lng: -97.77, weight: 0.65 },
  { name: "North Loop", lat: 30.318, lng: -97.72, weight: 0.5 },
];

const SEATTLE: FixtureHood[] = [
  { name: "Capitol Hill", lat: 47.623, lng: -122.32, weight: 0.9 },
  { name: "Ballard", lat: 47.668, lng: -122.385, weight: 0.8 },
  { name: "Fremont", lat: 47.651, lng: -122.35, weight: 0.65 },
  { name: "Georgetown", lat: 47.546, lng: -122.32, weight: 0.5 },
  { name: "Belltown", lat: 47.614, lng: -122.346, weight: 0.75 },
  { name: "Columbia City", lat: 47.559, lng: -122.287, weight: 0.55 },
  { name: "University District", lat: 47.661, lng: -122.313, weight: 0.7 },
];

const hoodHeat = (lp: number, wp: number, wl: number, ls: number, pi: number, av: number, hp: number) => ({
  Chicago: { "Lincoln Park": lp, "Wicker Park": wp, "West Loop": wl, "Logan Square": ls, Pilsen: pi, Avondale: av, "Hyde Park": hp },
});

const demo = (a: number[], female: number): Demographics => ({
  age: { "24_and_younger": a[0], "25_to_29": a[1], "30_to_34": a[2], "35_to_44": a[3], "45_to_54": a[4], "55_and_older": a[5] },
  gender: { female, male: -female },
});

export const FAKE_GRAPH: FixtureGraph = {
  entities: [...ARTISTS, ...VENUES, ...PARTNERS, ...BRANDS, ...LOCALITIES],
  links: {
    "fa-marlow-vane": {
      "fa-halcyon-drive": 0.88, "fa-low-orchard": 0.9, "fa-pia-marsh": 0.7, "fa-copper-hours": 0.6, "fa-june-atlas": 0.92,
      "fa-fieldwork": 0.55, "fa-glass-meridian": 0.45, "fa-velvet-static": 0.8, "fa-orla-crane": 0.5, "fa-marlow-tide": 0.62,
      "fp-thalia": 0.93, "fp-copperline": 0.86, "fp-lantern": 0.74, "fp-greyhound": 0.66, "fp-riverside": 0.6,
      "fp-gold-coast": 0.8, "fp-bistro": 0.74, "fp-two-moons": 0.6, "fp-sola": 0.58,
      "fb-northwind": 0.85, "fb-fieldline": 0.81, "fb-lumen": 0.78, "fb-halo": 0.63, "fb-tidewater": 0.54, "fb-bigcola": 0.6, "fb-megamart": 0.4,
      ...Object.fromEntries(Object.entries(LOCALITY_AFFINITY).map(([n, a]) => [`fl-${slug(n)}`, a])),
    },
    "fa-halcyon-drive": {
      "fa-marlow-vane": 0.7, "fa-copper-hours": 0.8, "fa-fieldwork": 0.76,
      "fp-two-moons": 0.92, "fp-sola": 0.89, "fp-calle": 0.84, "fp-ninth": 0.8, "fp-hollow-pine": 0.77, "fp-ember": 0.71, "fp-gold-coast": 0.3, "fp-bistro": 0.25,
      "fb-lumen": 0.86, "fb-northwind": 0.7,
    },
    "fa-marlow-tide": { "fa-orla-crane": 0.82, "fa-low-orchard": 0.74, "fa-june-atlas": 0.6, "fa-velvet-static": 0.55, "fa-copper-hours": 0.5, "fa-marlow-vane": 0.58, "fb-tidewater": 0.7, "fb-fieldline": 0.66 },
    "fa-saint-rook": {
      "fa-pia-marsh": 0.86, "fa-glass-meridian": 0.82, "fa-june-atlas": 0.7, "fa-velvet-static": 0.6, "fa-halcyon-drive": 0.5,
      "fb-halo": 0.8, "fb-lumen": 0.75,
      ...Object.fromEntries(Object.entries(LOCALITY_AFFINITY).map(([n, a], i) => [`fl-${slug(n)}`, +(0.4 + ((a * 7 + i * 0.13) % 0.55)).toFixed(2)])),
    },
  },
  baseline: {
    "fa-halcyon-drive": 0.3, "fa-low-orchard": 0.4, "fa-pia-marsh": 0.22, "fa-copper-hours": 0.18, "fa-june-atlas": 0.55, "fa-fieldwork": 0.15,
    "fa-glass-meridian": 0.25, "fa-velvet-static": 0.65, "fa-orla-crane": 0.3, "fa-marlow-tide": 0.5, "fa-marlow-vane": 0.5,
    "fp-thalia": 0.4, "fp-copperline": 0.45, "fp-lantern": 0.3, "fp-greyhound": 0.32, "fp-riverside": 0.5,
    "fp-two-moons": 0.3, "fp-sola": 0.28, "fp-calle": 0.35, "fp-ninth": 0.3, "fp-hollow-pine": 0.33, "fp-ember": 0.36, "fp-gold-coast": 0.4, "fp-bistro": 0.4,
    "fb-northwind": 0.25, "fb-fieldline": 0.28, "fb-lumen": 0.3, "fb-halo": 0.3, "fb-tidewater": 0.3, "fb-bigcola": 0.55, "fb-megamart": 0.5,
    ...Object.fromEntries(Object.keys(LOCALITY_AFFINITY).map((n) => [`fl-${slug(n)}`, 0.3])),
  },
  trending: ["fa-halcyon-drive", "fa-pia-marsh", "fa-fieldwork"],
  hoods: { Chicago: CHICAGO, Austin: AUSTIN, Seattle: SEATTLE },
  heat: {
    "fa-marlow-vane": hoodHeat(1, 0.75, 0.85, 0.05, 0.05, 0.05, 0.1),
    "fa-halcyon-drive": hoodHeat(0.1, 0.45, 0.05, 0.95, 0.9, 0.6, 0.55),
    "fa-low-orchard": hoodHeat(0.5, 0.8, 0.3, 0.4, 0.2, 0.85, 0.1),
    "fa-pia-marsh": hoodHeat(0.1, 0.2, 0.3, 0.3, 0.8, 0.1, 0.9),
    "fa-june-atlas": hoodHeat(0.9, 0.6, 0.7, 0.2, 0.1, 0.1, 0.15),
    "fa-glass-meridian": hoodHeat(0.5, 0.4, 0.6, 0.2, 0.2, 0.1, 0.3),
    "fa-velvet-static": hoodHeat(0.8, 0.8, 0.6, 0.3, 0.1, 0.2, 0.1),
    "fa-orla-crane": hoodHeat(0.4, 0.3, 0.2, 0.5, 0.2, 0.6, 0.2),
    "fa-marlow-tide": hoodHeat(0.6, 0.3, 0.5, 0.1, 0.1, 0.2, 0.3),
    "fa-saint-rook": hoodHeat(0.6, 0.7, 0.9, 0.3, 0.2, 0.1, 0.4),
    // Copper Hours and Fieldwork are too small for their own heat; their scenes stand in.
    [genreTag("garage")]: hoodHeat(0.1, 0.4, 0.1, 0.8, 0.4, 0.5, 0.1),
    [genreTag("post_punk")]: hoodHeat(0.1, 0.4, 0.1, 0.5, 0.3, 0.85, 0.1),
    // Copper Hours and Fieldwork have no heat in other cities either
    "fa-copper-hours": {},
    "fa-fieldwork": {},
  },
  demographics: {
    "fa-marlow-vane": demo([-0.35, 0.05, 0.25, 0.2, -0.1, -0.4], 0.04),
    "fa-halcyon-drive": demo([0.4, 0.3, 0.0, -0.2, -0.4, -0.6], 0.16),
    "fa-low-orchard": demo([0.0, 0.2, 0.2, 0.0, -0.2, -0.3], 0.2),
    "fa-pia-marsh": demo([0.5, 0.3, -0.1, -0.3, -0.5, -0.7], 0.3),
    "fa-june-atlas": demo([0.1, 0.2, 0.1, -0.1, -0.2, -0.4], 0.1),
    "fa-saint-rook": demo([0.3, 0.25, 0.05, -0.15, -0.35, -0.5], 0.36),
  },
};
