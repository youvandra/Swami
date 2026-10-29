// The tools the agent calls. Each one fetches from Qloo (or the fixture), scores in src/lib/score, and builds
// an artifact in code: the model picks tools and writes prose, and never produces a number.

import type { Artifact, Audience, OpenerRow, ProposalTemplate, Show } from "../agent/types.ts";
import { draftProposal, templateOf } from "../proposal.ts";
import { genreOf, type Entity, type HeatCell } from "../qloo/types.ts";
import { PARTNER_KINDS, PLACE_TAG, VENUE_LADDER, type PartnerKind, type VenueTag } from "../qloo/urns.ts";
import { buildAudience } from "../score/audience.ts";
import { SIZE_LABEL, sizeFromCapacity, sizeFromPopularity } from "../score/size.ts";
import { CITIES, findCity } from "../score/cities.ts";
import { strongest, toHoods, topAdded } from "../score/heat.ts";
import { listing } from "../score/normalize.ts";
import { rankOpeners, type OpenerCandidate } from "../score/opener.ts";
import { rankPartners } from "../score/partners.ts";
import { inRegion, routeTour } from "../score/routing.ts";
import { rankSponsors } from "../score/sponsors.ts";
import { rankVenues } from "../score/venues.ts";
import { capacityAssumed, once, rejectedIds, resolveArtist, showOf, step, ToolError, uid, type ToolContext } from "./context.ts";

/** Cities weighed for a leg with no region or city list: the largest markets, first in CITIES. */
const NATIONAL_CITIES = 20;
/** How many related acts get their own heat pulled; bounds the Qloo calls per ranking. */
const POOL = 10;
const ROSTER_MAX = 30;
/** Places an act must climb under bias.trends to count as rising. */
const RISE = 3;

export type ToolResult = { artifact?: Artifact; facts: Record<string, unknown> };

// ── search ─────────────────────────────────────────────────────────────────────────────────────────────────

export type Candidate = { id: string; name: string; image?: string; popularity?: number; genre?: string; detail?: string };

export async function searchArtist(ctx: ToolContext, input: { name: string; take?: number }): Promise<{ candidates: Candidate[]; ambiguous: boolean }> {
  const all = await step(ctx, `Looked up “${input.name}”`, () => once(ctx, `search:${input.name.trim().toLowerCase()}`, () => ctx.q.search(input.name, "artist", input.take ?? 5)), (h) => (h.length === 1 ? "1 match" : `${h.length} matches`));
  for (const h of all) ctx.seen.set(h.id, h);
  // acts the user turned down on the cards never come back
  const rejected = rejectedIds(ctx.entities);
  const hits = all.filter((h) => !rejected.has(h.id));
  const candidates = hits.map((h) => ({ id: h.id, name: h.name, image: h.imageUrl, popularity: h.popularity, genre: genreOf(h), detail: h.detail }));
  return { candidates, ambiguous: isAmbiguous(input.name, hits) };
}

/**
 * One hit whose name is exactly the query is the act meant. Two exact names (two bands called Phoenix), or no
 * exact name and two hits close in popularity, mean the name alone picks none. Live popularity sits near 1 for
 * most known acts, so popularity alone never settles it when the name matches.
 */
export function isAmbiguous(query: string, hits: Entity[]): boolean {
  if (hits.length < 2) return false;
  const exact = hits.filter((h) => actKey(h.name) === actKey(query));
  if (exact.length === 1) return false;
  if (exact.length > 1) return true;
  return Math.abs((hits[0].popularity ?? 0) - (hits[1].popularity ?? 0)) <= 0.15;
}

/** Resolve the headliner, as a visible step only when the name was not looked up already this turn. */
function findHeadliner(ctx: ToolContext, name: string): Promise<Entity> {
  if (ctx.memo.has(`search:${name.trim().toLowerCase()}`)) return resolveArtist(ctx, name);
  return step(ctx, "Found the headliner in the taste graph", () => resolveArtist(ctx, name), (h) => h.name);
}

/** "The Low Orchard", "Low Orchard" and "low orchard!" are one act; "&" and "and" are one word. */
export const actKey = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const sameAct = (a: string, b: string) => actKey(a) === actKey(b);

// ── openers ────────────────────────────────────────────────────────────────────────────────────────────────

export type RankInput = { headliner: string; city?: string; date?: string; venue?: string; capacity?: number; roster?: { name: string; acts: string[] }; risingOnly?: boolean; exclude?: string[] };

type Ranking = { show: Show; head: Entity; headHeat: HeatCell[]; rows: (OpenerRow & { id: string })[]; heatByAct: Map<string, HeatCell[]>; related: number };

async function heatOf(ctx: ToolContext, e: Entity, city: string): Promise<{ cells: HeatCell[]; estimated: boolean }> {
  const own = await once(ctx, `heat:${e.id}:${city}`, () => ctx.q.heatmap({ entity: e.id }, city));
  if (own.length) return { cells: own, estimated: false };
  const scene = e.tags?.find((t) => t.id.startsWith("urn:tag:genre:music"));
  if (!scene) return { cells: [], estimated: true };
  return { cells: await once(ctx, `heat:${scene.id}:${city}`, () => ctx.q.heatmap({ tag: scene.id }, city)), estimated: true };
}

function ranking(ctx: ToolContext, input: RankInput): Promise<Ranking> {
  const show = showOf(ctx, input);
  const key = `rank:${input.headliner}:${show.city}:${input.roster?.name ?? ""}:${input.risingOnly ?? ""}:${(input.exclude ?? []).join(",")}`;
  return once(ctx, key, async () => {
    const head = await findHeadliner(ctx, input.headliner);
    show.headliner = head.name;
    const [related, local, rising, headHeat] = await step(
      ctx,
      "Searched the taste graph",
      () =>
        Promise.all([
          once(ctx, `related:${head.id}`, () => ctx.q.insights({ type: "artist", seeds: [head.id], take: 50 })),
          once(ctx, `related:${head.id}:${show.city}`, () => ctx.q.insights({ type: "artist", seeds: [head.id], city: show.city, take: 50 })),
          once(ctx, `rising:${head.id}`, () => ctx.q.insights({ type: "artist", seeds: [head.id], trending: true, take: 50 })),
          once(ctx, `heat:${head.id}:${show.city}`, () => ctx.q.heatmap({ entity: head.id }, show.city)),
        ]),
      ([r]) => `${head.name} → ${r.length} related acts`,
    );
    // rising: acts the trend bias lifts well above where they sit in the plain list
    const plainRank = new Map(related.map((r, i) => [r.id, i]));
    const risingIds = new Set(rising.filter((r, i) => !plainRank.has(r.id) || plainRank.get(r.id)! - i >= RISE).map((r) => r.id));
    const rank = new Map(related.map((r, i) => [r.id, i + 1]));
    const localBy = new Map(local.map((r) => [r.id, r.affinity ?? 0]));

    // The pool: the roster's acts when one is attached, else the closest related acts.
    let pool: Entity[];
    const unknown: string[] = [];
    if (input.roster) {
      const acts = input.roster.acts.slice(0, ROSTER_MAX);
      const found = await step(
        ctx,
        `Matched ${input.roster.name}`,
        () => Promise.all(acts.map((a) => once(ctx, `search:${a.trim().toLowerCase()}`, () => ctx.q.search(a, "artist", 3)).then((h) => h.find((x) => sameAct(x.name, a)) ?? null))),
        (f) => `${f.filter(Boolean).length} of ${acts.length} acts known to Qloo`,
      );
      acts.forEach((a, i) => (found[i] ? undefined : unknown.push(a)));
      pool = found.filter((x): x is Entity => !!x && x.id !== head.id);
      const missing = pool.filter((p) => !rank.has(p.id)).map((p) => p.id);
      if (missing.length) {
        const extra = await ctx.q.insights({ type: "artist", seeds: [head.id], ids: missing, take: missing.length });
        const by = new Map(extra.map((e) => [e.id, e.affinity ?? 0]));
        pool = pool.map((p) => (rank.has(p.id) ? (related.find((r) => r.id === p.id) ?? p) : { ...p, affinity: by.get(p.id) ?? 0 }));
      } else pool = pool.map((p) => related.find((r) => r.id === p.id) ?? p);
    } else {
      pool = related.filter((r) => !input.risingOnly || risingIds.has(r.id)).slice(0, POOL);
    }
    if (pool.length === 0 && unknown.length === 0) throw new ToolError(input.risingOnly ? `No rising acts among ${head.name}'s matches.` : `Qloo has no related acts for ${head.name}.`);
    for (const p of pool) ctx.seen.set(p.id, p);

    const heats = await step(
      ctx,
      `Pulled neighbourhood heat for ${show.city}`,
      () => Promise.all(pool.map((p) => heatOf(ctx, p, show.city))),
      (h) => (headHeat.length ? `${headHeat.length} neighbourhoods, ${pool.length} acts${h.some((x) => x.estimated) ? `, ${h.filter((x) => x.estimated).length} from their scene` : ""}` : `no neighbourhood heat for ${show.city} yet`),
    );

    const rosterSet = new Set((input.roster?.acts ?? []).map(actKey));
    const candidates: OpenerCandidate[] = pool.map((p, i) => ({
      id: p.id,
      name: p.name,
      genre: genreOf(p) ?? "Artist",
      affinity: p.affinity ?? 0,
      cityAffinity: localBy.get(p.id),
      relatedRank: rank.get(p.id),
      relatedOf: related.length,
      heat: heats[i].cells,
      estimated: heats[i].estimated,
      rising: risingIds.has(p.id),
      onRoster: rosterSet.has(actKey(p.name)),
      popularity: p.popularity,
    }));
    // Roster acts Qloo has never heard of rank at the bottom of the field's fit, with no heat, and say so.
    const floor = Math.min(...candidates.map((c) => c.affinity), 0.4);
    for (const name of unknown) candidates.push({ id: `unknown:${name}`, name, genre: "From roster", affinity: floor * 0.9, heat: [], estimated: true, rising: false, onRoster: true });

    const rows = await step(ctx, "Scored every act", async () => rankOpeners({ headliner: head.name, headlinerPopularity: head.popularity, headlinerHeat: headHeat, candidates, exclude: input.exclude, field: { related: related.map((r) => r.affinity ?? 0), city: local.map((r) => r.affinity ?? 0) } }), () => `fit × reach gain${input.roster ? ", roster filter on" : ""}`);
    for (const r of rows) if (r.id.startsWith("unknown:")) r.why = "Qloo has no profile for this act yet, so it sits below the field on fit with no heat of its own. Add it again once it has releases out.";
    return { show, head, headHeat, rows, heatByAct: new Map(pool.map((p, i) => [p.id, heats[i].cells])), related: related.length };
  });
}

const strip = <T extends { id: string }>(r: T) => {
  const { id: _, ...rest } = r;
  return rest;
};

export async function rankOpenersTool(ctx: ToolContext, input: RankInput): Promise<ToolResult> {
  const r = await ranking(ctx, input);
  const rows = r.rows.map(strip);
  return {
    artifact: {
      id: uid(),
      type: "opener_ranking",
      title: `Openers for ${r.show.headliner}`,
      subtitle: input.roster ? `${r.show.city} · ${r.show.date} · ${rows.length} acts on ${input.roster.name}` : `${r.show.city} · ${r.show.date} · ${rows.length} candidates`,
      show: r.show,
      rows,
    },
    facts: {
      headliner: r.show.headliner,
      city: r.show.city,
      roster: input.roster?.name,
      candidates: rows.length,
      relatedActs: r.related,
      top: rows.slice(0, 3).map((x) => ({ name: x.name, score: x.score, fit: x.fit, reachGain: x.reachGain, hoods: x.hoods, estimated: x.estimated })),
      estimated: rows.filter((x) => x.estimated).length,
      heat: r.headHeat.length > 0,
    },
  };
}

/** The opener a follow-up means: the one named, else the top of this run's ranking. */
async function openerFor(ctx: ToolContext, input: RankInput & { opener?: string }): Promise<{ r: Ranking; opener: Entity; cells: HeatCell[]; estimated: boolean }> {
  const r = await ranking(ctx, input);
  let opener: Entity;
  if (input.opener) opener = await resolveArtist(ctx, input.opener);
  else {
    const top = r.rows.find((x) => !x.id.startsWith("unknown:"));
    if (!top) throw new ToolError("No ranked act has heat data to map.");
    opener = ctx.seen.get(top.id)!;
  }
  const own = r.heatByAct.get(opener.id);
  const h = own ? { cells: own, estimated: !!r.rows.find((x) => x.id === opener.id)?.estimated } : await heatOf(ctx, opener, r.show.city);
  return { r, opener, ...h };
}

// ── crowd map ──────────────────────────────────────────────────────────────────────────────────────────────

export async function crowdMapTool(ctx: ToolContext, input: RankInput & { opener?: string }): Promise<ToolResult> {
  const { r, opener, cells, estimated } = await openerFor(ctx, input);
  const hoods = await step(ctx, "Compared fan maps", async () => toHoods(r.show.city, r.headHeat, cells), (h) => `added crowd across ${h.length} neighbourhoods`);
  if (hoods.length === 0) throw new ToolError(`No neighbourhood heat for ${r.show.city} yet.`);
  const added = topAdded(r.headHeat, cells, 3).map((x) => x.name);
  return {
    artifact: { id: uid(), type: "crowd_map", title: `${opener.name} + ${r.show.headliner}`, subtitle: `${r.show.city} · added crowd by neighbourhood${estimated ? " · estimated" : ""}`, show: r.show, opener: opener.name, hoods },
    facts: { opener: opener.name, headliner: r.show.headliner, city: r.show.city, addedIn: added, headlinerStrongIn: strongest(r.headHeat), estimated },
  };
}

// ── routing ────────────────────────────────────────────────────────────────────────────────────────────────

export async function routeTourTool(ctx: ToolContext, input: { headliner: string; region?: string; abroad?: string; cities?: string[]; anchorCity?: string; stops?: number; date?: string; capacity?: number }): Promise<ToolResult> {
  const head = await findHeadliner(ctx, input.headliner);
  const show = showOf(ctx, { ...input, headliner: head.name, city: input.anchorCity });
  // One heat call per city, so a leg with no region weighs the largest markets only.
  const allowed = input.cities?.length ? input.cities.map(findCity).filter((c) => !!c) : input.region ? inRegion(CITIES, input.region) : CITIES.slice(0, NATIONAL_CITIES);
  const outside = input.abroad ?? (input.cities?.length && allowed.length === 0 ? listing(input.cities) : undefined);
  if (outside) throw new ToolError(`Tour routing covers US cities for now, and ${outside} is outside them. Name a US region (Midwest, Northeast, South, West) or US cities, and venues, crowd maps and audiences still work anywhere Qloo has places.`);
  const leans = await step(
    ctx,
    "Ranked cities by fan affinity",
    () => Promise.all(allowed.map((city) => ctx.q.cityLean(head.id, city.name).then((lean) => ({ city, lean })))),
    (l) => `${head.name} across ${l.filter((x) => x.lean).length} cities`,
  );
  const known = leans.filter((x) => x.lean);
  if (known.length === 0) throw new ToolError(`Qloo has no city affinity for ${head.name}${input.region ? ` in the ${input.region}` : ""}.`);
  const anchor = input.anchorCity ? findCity(input.anchorCity)?.name : ctx.defaults.city && known.some((k) => k.city.name === findCity(ctx.defaults.city!)?.name) ? findCity(ctx.defaults.city)!.name : undefined;
  const stops = await step(ctx, "Ordered the leg by distance", async () => routeTour({ cities: known.map((k) => ({ city: k.city, affinity: k.lean!.affinity, baseline: k.lean!.baseline })), anchor, stops: input.stops ?? 8, capacity: show.capacity }), (s) => `${s.length} stops, ${s.reduce((n, x) => n + x.milesFromPrev, 0).toLocaleString("en-US")} miles`);
  const region = input.region ? input.region[0].toUpperCase() + input.region.slice(1) : "Tour";
  const leg = input.date ? `${region}, ${input.date}` : region;
  const ranked = [...stops].sort((a, b) => b.affinity - a.affinity);
  return {
    artifact: { id: uid(), type: "routing", title: `${region === "Tour" ? "Tour" : `${region} leg`} · ${head.name}`, subtitle: `${stops.length} cities ranked by fan affinity · suggested order${capacityAssumed(ctx, input) ? ` · rooms assume ${show.capacity.toLocaleString("en-US")} cap` : ""}`, show, leg, stops },
    facts: { capacityAssumed: capacityAssumed(ctx, input), headliner: head.name, region, order: stops.map((s) => s.city), strongest: ranked.slice(0, 3).map((s) => s.city), weakest: ranked.slice(-2).map((s) => s.city), miles: stops.reduce((n, x) => n + x.milesFromPrev, 0) },
  };
}

// ── venues ─────────────────────────────────────────────────────────────────────────────────────────────────

const displayTags = (e: Entity) => (e.tags ?? []).filter((t) => !t.type?.startsWith("urn:tag:category")).map((t) => t.name);

export async function findVenuesTool(ctx: ToolContext, input: { headliner: string; city?: string; capacity?: number; date?: string }): Promise<ToolResult> {
  const head = await findHeadliner(ctx, input.headliner);
  const show = showOf(ctx, { ...input, headliner: head.name });
  // the stated capacity sizes the room; without one, how big the act draws does
  const assumed = capacityAssumed(ctx, input);
  const size = assumed ? sizeFromPopularity(head.popularity) : sizeFromCapacity(show.capacity);
  const ladder = VENUE_LADDER[size];
  const places: Entity[] = [];
  const used: VenueTag[] = [];
  for (const tag of ladder.slice(0, 3)) {
    if (places.length >= 5) break;
    const got = await step(ctx, `Searched ${tag.plural} in ${show.city}`, () => ctx.q.insights({ type: "place", seeds: [head.id], city: show.city, tags: [tag.id], take: 20 }), (p) => `${p.length} found`);
    // Qloo lists one place twice under two ids now and then (Jakarta International Velodrome)
    const fresh = got.filter((p, i) => !places.some((x) => x.id === p.id || x.name === p.name) && got.findIndex((x) => x.name === p.name) === i);
    if (fresh.length) used.push(tag);
    places.push(...fresh);
  }
  if (places.length === 0) throw new ToolError(`Qloo has no ${listing(ladder.slice(0, 3).map((t) => t.plural))} tagged in ${show.city}.`);
  // said when the first tag tried came back empty, so the list is plainly from the next ones
  const fallback = used[0] !== ladder[0] ? `Qloo has no ${ladder[0].plural} tagged in ${show.city}, so these are ${listing(used.map((t) => t.plural))}.` : undefined;
  const sizing = assumed ? `for a ${SIZE_LABEL[size]} act` : `sized against ${show.capacity.toLocaleString("en-US")} cap`;
  const venues = await step(ctx, "Scored venues by audience fit", async () => rankVenues(head.name, show.capacity, places.map((p) => ({ name: p.name, hood: p.hood, capacity: p.capacity, tags: displayTags(p), affinity: p.affinity ?? 0 }))), () => `${head.name} fans`);
  return {
    artifact: { id: uid(), type: "venues", title: `Rooms for ${head.name} in ${show.city}`, subtitle: `${venues.length} ${listing(used.map((t) => t.plural))} ranked by audience fit · ${sizing}`, show, venues },
    facts: { capacityAssumed: assumed, city: show.city, best: venues[0].name, bestCapacity: venues[0].capacity ?? "unknown", next: venues[1]?.name, capacityWanted: assumed ? "not given" : show.capacity, size: SIZE_LABEL[size], searched: used.map((t) => t.plural), fallback },
  };
}

// ── partners ───────────────────────────────────────────────────────────────────────────────────────────────

export async function findPartnersTool(ctx: ToolContext, input: RankInput & { opener?: string; kinds?: PartnerKind[] }): Promise<ToolResult> {
  const { r, opener, cells } = await openerFor(ctx, input);
  const hoods = topAdded(r.headHeat, cells, 3).map((x) => x.name);
  const kinds = PARTNER_KINDS.filter((k) => !input.kinds?.length || input.kinds.includes(k.kind));
  const places = await step(ctx, "Found places the crowd already goes", () => ctx.q.insights({ type: "place", seeds: [opener.id], city: r.show.city, tags: kinds.map((k) => k.tag), take: 30 }), () => listing(kinds.map((k) => k.kind.toLowerCase() + "s")));
  const typed = places.map((p) => ({ p, kind: kinds.find((k) => p.tags?.some((t) => t.id === k.tag))?.kind })).filter((x): x is { p: Entity; kind: PartnerKind } => !!x.kind);
  if (typed.length === 0) throw new ToolError(`No bars, shops or cafés for ${r.show.city} in the taste graph.`);
  const partners = await step(ctx, "Filtered to the added-crowd neighbourhoods", async () => rankPartners(typed.map(({ p, kind }) => ({ name: p.name, kind, hood: p.hood, affinity: p.affinity ?? 0 })), hoods), () => listing(hoods) || "whole city");
  return {
    artifact: { id: uid(), type: "partners", title: `Co-promo partners · ${r.show.city}`, subtitle: `${partners.length} places whose regulars share the crowd`, show: r.show, partners },
    facts: { opener: opener.name, hoods, top: partners.slice(0, 2).map((p) => p.name), count: partners.length },
  };
}

// ── sponsors ───────────────────────────────────────────────────────────────────────────────────────────────

export async function matchSponsorsTool(ctx: ToolContext, input: { headliner: string; city?: string; date?: string; categories?: string[] }): Promise<ToolResult> {
  const head = await findHeadliner(ctx, input.headliner);
  const show = showOf(ctx, { ...input, headliner: head.name });
  const brands = await step(ctx, "Searched brand affinity", () => once(ctx, `brands:${head.id}`, () => ctx.q.insights({ type: "brand", seeds: [head.id], take: 30 })), () => `${head.name} fans vs the national baseline`);
  const categoryOf = (b: Entity) => b.tags?.find((t) => t.type?.includes("brand"))?.name ?? "Brand";
  const wanted = brands.filter((b) => !input.categories?.length || input.categories.some((c) => categoryOf(b).toLowerCase().includes(c.toLowerCase())));
  const base = await ctx.q.baseline({ type: "brand", seeds: [] }, wanted.map((b) => b.id));
  const sponsors = await step(ctx, "Ranked brands by lift", async () => rankSponsors(wanted.map((b) => ({ name: b.name, category: categoryOf(b), affinity: b.affinity ?? 0, baseline: base.get(b.id) }))), (s) => `${s.length} brands these fans pick beyond their usual pull`);
  if (sponsors.length === 0) throw new ToolError(`No brand stands out for ${head.name}'s fans yet.`);
  const broad = sponsors.some((s) => s.broad);
  return {
    artifact: { id: uid(), type: "sponsors", title: `Sponsors for ${head.name}`, subtitle: broad ? `${sponsors.length} brands the fans pick most · broad fan base` : `${sponsors.length} brands whose customers love this music`, show, sponsors },
    facts: broad
      ? { headliner: head.name, top: sponsors.slice(0, 3).map((s) => s.brand), count: sponsors.length, note: "No brand beats the baseline: the fan base is broad, so these are the fans' top picks by affinity, with no lift to quote." }
      : { headliner: head.name, top: sponsors.slice(0, 3).map((s) => `${s.brand} ${s.lift}×`), count: sponsors.length },
  };
}

// ── audience ───────────────────────────────────────────────────────────────────────────────────────────────

async function tasteOf(ctx: ToolContext, e: Entity, cells: HeatCell[], city: string) {
  const [acts, food] = await Promise.all([
    once(ctx, `related:${e.id}`, () => ctx.q.insights({ type: "artist", seeds: [e.id], take: 50 })),
    ctx.q.insights({ type: "place", seeds: [e.id], city, tags: [PLACE_TAG.restaurant, PLACE_TAG.bar], take: 10 }),
  ]);
  const genres = [...new Set(acts.slice(0, 8).map(genreOf).filter((g): g is string => !!g))].slice(0, 2);
  const eats = [...new Set(food.flatMap((p) => displayTags(p)))].slice(0, 2);
  return { genres, hoods: strongest(cells, 2), eats };
}

export async function audienceTool(ctx: ToolContext, input: RankInput & { opener?: string }): Promise<ToolResult> {
  const { r, opener, cells } = await openerFor(ctx, input);
  const [dh, dopen] = await step(ctx, "Pulled demographics", () => Promise.all([ctx.q.demographics(r.head.id), ctx.q.demographics(opener.id)]), () => `${r.show.headliner} and ${opener.name}`);
  const [th, to] = await step(ctx, "Compared taste across domains", () => Promise.all([tasteOf(ctx, r.head, r.headHeat, r.show.city), tasteOf(ctx, opener, cells, r.show.city)]), () => "music, places, food");
  const dash = (xs: string[]) => (xs.length ? xs.join(", ") : "—");
  const edge = (other: HeatCell[], own: HeatCell[], fallback: string[]) => {
    const names = topAdded(other, own, 2).map((x) => x.name);
    return names.length ? names : fallback;
  };
  const traits: Audience["traits"] = [
    { label: "Also listens to", headliner: dash(th.genres), opener: dash(to.genres) },
    // where each act out-draws the other: the hottest blocks alone are downtown for every big act
    { label: "Stronger in", headliner: dash(edge(cells, r.headHeat, th.hoods)), opener: dash(edge(r.headHeat, cells, to.hoods)) },
    { label: "Eats at", headliner: dash(th.eats), opener: dash(to.eats) },
  ].filter((t) => t.headliner !== "—" || t.opener !== "—");
  const audience = buildAudience(dh, dopen, traits);
  const u30 = (side: "headliner" | "opener") => Math.round((audience.ages[0][side] + audience.ages[1][side]) * 100);
  return {
    artifact: { id: uid(), type: "audience", title: `Who comes: ${r.show.headliner} + ${opener.name}`, subtitle: "Age, gender and taste, side by side", show: r.show, opener: opener.name, audience },
    facts: { opener: opener.name, headliner: r.show.headliner, under30Pct: { headliner: dh ? u30("headliner") : null, opener: dopen ? u30("opener") : null }, womenPct: { headliner: dh ? Math.round(audience.women.headliner * 100) : null, opener: dopen ? Math.round(audience.women.opener * 100) : null }, noDemographicsFor: [...(dh ? [] : [r.show.headliner]), ...(dopen ? [] : [opener.name])] },
  };
}

// ── proposal and email ─────────────────────────────────────────────────────────────────────────────────────

async function factsFor(ctx: ToolContext, input: RankInput) {
  const { r, opener, cells } = await openerFor(ctx, input);
  const hoods = topAdded(r.headHeat, cells, 3).map((x) => x.name);
  return { r, opener, hoods };
}

export async function draftProposalTool(ctx: ToolContext, input: RankInput & { template?: ProposalTemplate; sponsor?: string }): Promise<ToolResult> {
  const { r, hoods } = await factsFor(ctx, input);
  const picks = r.rows.slice(0, 3).map(({ name, score, why }) => ({ name, score, why }));
  const template = input.template ?? "promoter";
  // A proposal names real partners and, for a sponsor pitch, the brand that fits best. Either lookup may come
  // back empty; the draft then speaks in general terms instead of inventing names.
  const [partners, sponsor] = await Promise.all([
    template === "sponsor" ? Promise.resolve(null) : findPartnersTool(ctx, input).catch(() => null),
    template === "sponsor" && !input.sponsor ? matchSponsorsTool(ctx, input).catch(() => null) : Promise.resolve(null),
  ]);
  const partnerNames = partners?.artifact?.type === "partners" ? partners.artifact.partners.slice(0, 2).map((p) => p.name) : [];
  const brand = input.sponsor ?? (sponsor?.artifact?.type === "sponsors" ? sponsor.artifact.sponsors[0]?.brand : undefined);
  const facts = { hoods, partners: partnerNames, sponsor: brand };
  const d = await step(ctx, "Drafted the proposal", async () => draftProposal(template, r.show, picks, facts), (x) => `${x.sections.length} sections, ${picks.length} picks`);
  return {
    artifact: { id: uid(), type: "proposal", title: d.title, subtitle: `Draft · ${d.sections.length} sections`, show: r.show, template: d.template, headline: d.headline, to: d.to, from: ctx.workspace, date: today(), picks, sections: d.sections, facts },
    facts: { template: templateOf(template).label, headliner: r.show.headliner, top: picks[0]?.name, alternates: picks.slice(1).map((p) => p.name) },
  };
}

export type EmailKind = "opener" | "venue" | "partner" | "sponsor";

export async function draftEmailTool(ctx: ToolContext, input: RankInput & { kind: EmailKind; to?: string }): Promise<ToolResult> {
  const { r, opener, hoods } = await step(ctx, "Read the ranking and the map", () => factsFor(ctx, input), (f) => `top pick: ${f.opener.name}`);
  const show = r.show;
  const cap = show.capacity.toLocaleString("en-US");
  // "at The Thalia Room, Chicago" with a venue, "in Chicago" without one
  const place = show.venue ? `at ${show.venue}, ${show.city}` : `in ${show.city}`;
  const where = hoods.length ? listing(hoods.slice(0, 2)) : `the parts of ${show.city} where our presale is thinnest`;
  const sign = `Best,\n${ctx.workspace}`;
  // the model often passes "Lucy Dacus's team"; the greetings add "team" themselves
  const name = input.to?.replace(/(?:['’]s)?\s+team\.?$/i, "").trim() || undefined;
  let d: { who: string; to: string; subject: string; body: string };
  if (input.kind === "sponsor") {
    const who = name ?? "Partnerships";
    d = { who, to: "partnerships@brand.example", subject: `${show.headliner} in ${show.city}, ${show.date}: sampling partnership`, body: `Hi ${who} team,\n\nWe're presenting ${show.headliner} ${place} on ${show.date}${show.capacityAssumed ? "" : `, a ${cap}-cap room`}.\n\nTheir fans pick your brand far more often than the average concert-goer, so we'd love to set up a sampling bar next to merch, plus your logo on the promo links we send to ${where}.\n\nCould we talk this week?\n\n${sign}` };
  } else if (input.kind === "venue") {
    const who = name ?? show.venue ?? "Booking";
    d = { who, to: "booking@venue.example", subject: `Hold request: ${show.headliner}, ${show.date}`, body: `Hi ${who} team,\n\nWe'd like to place a first hold on ${show.date} for ${show.headliner} with support from ${opener.name}.\n\nWe expect a full ${show.capacityAssumed ? "room" : `${cap}-cap room`}: the pairing adds a crowd from ${where} on top of the headliner's regulars.\n\nCan you confirm the date is open and send your current deal sheet?\n\n${sign}` };
  } else if (input.kind === "partner") {
    const who = name ?? "there";
    d = { who, to: "hello@partner.example", subject: `Co-promo idea: ${show.headliner} + ${opener.name}, ${show.date}`, body: `Hi ${who},\n\nWe're putting on ${show.headliner} with ${opener.name} ${place} on ${show.date}. A lot of your regulars are fans of both acts.\n\nWould you host a pre-show night or put our flyer on the counter? You'd get your own ticket link, a pair of guest-list spots and a shout-out in our posts.\n\n${sign}` };
  } else {
    const who = name ?? opener.name;
    d = { who, to: "booking@artist.example", subject: `Support slot: ${show.headliner} ${show.venue ? `at ${show.venue}` : `in ${show.city}`}, ${show.date}`, body: `Hi ${who} team,\n\nWe're booking support for ${show.headliner} ${place}, on ${show.date}.\n\nYour fans rank ${show.headliner} among the acts they love most, and they live in ${where}, where our presale needs a lift. We'd like to offer you the 30-minute support slot.\n\nAre you holding that date? Happy to send terms today.\n\n${sign}` };
  }
  await step(ctx, "Drafted the email", async () => d, () => "subject, body, recipients");
  return { artifact: { id: uid(), type: "email", title: `Email · ${d.who}`, subtitle: "Draft", show, to: d.to, cc: "", subject: d.subject, body: d.body }, facts: { kind: input.kind, to: d.who, opener: opener.name, subject: d.subject, body: d.body } };
}

const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
