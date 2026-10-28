// Live probe of every Qloo call Swami makes. Run: node --env-file=.env.local scripts/probe-qloo.ts [headliner...]
// Raw responses land in fixtures/real/ (gitignored, never committed) with a summary in fixtures/real/REPORT.md.

import { mkdirSync, writeFileSync } from "node:fs";
import { HttpQloo } from "../src/lib/qloo/client.ts";
import { PARTNER_KINDS, PLACE_TAG } from "../src/lib/qloo/urns.ts";

const key = process.env.QLOO_API_KEY;
if (!key) {
  console.error("QLOO_API_KEY is empty; nothing to probe.");
  process.exit(1);
}

const OUT = "fixtures/real";
mkdirSync(OUT, { recursive: true });
const HEADLINERS = process.argv.slice(2).length ? process.argv.slice(2) : ["Big Thief", "Japanese Breakfast", "Snail Mail", "Khruangbin", "Alvvays", "Wednesday", "MJ Lenderman", "Waxahatchee", "Hovvdy", "Indigo De Souza"];
const CITIES = ["Chicago", "Austin", "Seattle"];

const q = new HttpQloo(key, process.env.QLOO_BASE_URL || undefined);
const log: { url: string; ms: number; size: number }[] = [];
let n = 0;
q.tap = (url, body, ms) => {
  const text = JSON.stringify(body, null, 2);
  writeFileSync(`${OUT}/${String(++n).padStart(3, "0")}.json`, JSON.stringify({ url, body }, null, 2));
  log.push({ url, ms, size: text.length });
};

const lines: string[] = [`# Qloo probe · ${new Date().toISOString()}`, "", `Base: ${process.env.QLOO_BASE_URL || "default"}`, ""];
const note = (s: string) => (console.log(s), lines.push(s));
const attempt = async <T>(label: string, f: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await f();
  } catch (e) {
    note(`- ${label}: FAILED ${(e as Error).message}`);
    return undefined;
  }
};

const heatSignatures = new Map<string, string>();
for (const name of HEADLINERS) {
  note(`\n## ${name}`);
  const hits = (await attempt("search", () => q.search(name, "artist", 5))) ?? [];
  note(`- search: ${hits.map((h) => `${h.name} (${h.popularity?.toFixed(2) ?? "?"})`).join(", ") || "none"}`);
  const top = hits[0];
  if (!top) continue;
  const related = (await attempt("related", () => q.insights({ type: "artist", seeds: [top.id], take: 50 }))) ?? [];
  note(`- related: ${related.length}; first: ${related.slice(0, 5).map((r) => r.name).join(", ")}`);
  const base = await attempt("baseline", () => q.baseline({ type: "artist", seeds: [] }, related.slice(0, 20).map((r) => r.id)));
  note(`- baseline: ${base?.size ?? 0} of ${Math.min(20, related.length)}`);
  const rising = await attempt("trending", () => q.insights({ type: "artist", seeds: [top.id], trending: true, take: 50 }));
  note(`- trending: ${rising?.length ?? 0}`);
  for (const city of CITIES) {
    const local = await attempt("local", () => q.insights({ type: "artist", seeds: [top.id], city, take: 50 }));
    const cells = (await attempt("heatmap", () => q.heatmap({ entity: top.id }, city))) ?? [];
    heatSignatures.set(`${name}@${city}`, cells.slice(0, 5).map((c) => c.affinity.toFixed(2)).join(","));
    note(`- ${city}: local ${local?.length ?? 0}, heat cells ${cells.length}, named ${cells.filter((c) => c.name).length}`);
    const venues = await attempt("venues", () => q.insights({ type: "place", seeds: [top.id], city, tags: [PLACE_TAG.venue], take: 20 }));
    note(`  venues ${venues?.length ?? 0}, with capacity ${venues?.filter((v) => v.capacity).length ?? 0}`);
    for (const k of PARTNER_KINDS) {
      const p = await attempt(k.kind, () => q.insights({ type: "place", seeds: [top.id], city, tags: [k.tag], take: 10 }));
      note(`  ${k.kind}: ${p?.length ?? 0}`);
    }
  }
  const locs = await attempt("localities", () => q.insights({ type: "locality", seeds: [top.id], take: 40 }));
  note(`- localities: ${locs?.length ?? 0}; first: ${locs?.slice(0, 5).map((l) => l.name).join(", ")}`);
  const brands = await attempt("brands", () => q.insights({ type: "brand", seeds: [top.id], take: 30 }));
  note(`- brands: ${brands?.length ?? 0}`);
  const demo = await attempt("demographics", () => q.demographics(top.id));
  note(`- demographics: ${demo ? JSON.stringify(demo) : "none"}`);
}

for (const t of ["music venue", "bar", "record store", "cafe", "restaurant"]) {
  const tags = await attempt(`tags ${t}`, () => q.tags(t));
  note(`- tags "${t}": ${tags?.slice(0, 4).map((x) => x.id).join(", ")}`);
}

// Kill rule: identical heat across cities means the added-crowd core has nothing to stand on.
const sigs = [...heatSignatures.values()].filter(Boolean);
note(`\n## Rules\n- heat present for ${sigs.length} of ${heatSignatures.size} artist-city pairs; distinct signatures ${new Set(sigs).size}`);
const ms = log.map((l) => l.ms).sort((a, b) => a - b);
note(`- calls ${log.length}, median ${ms[Math.floor(ms.length / 2)] ?? 0} ms, p90 ${ms[Math.floor(ms.length * 0.9)] ?? 0} ms`);
writeFileSync(`${OUT}/REPORT.md`, lines.join("\n") + "\n");
