import assert from "node:assert/strict";
import { test } from "node:test";
import type { HeatCell } from "../qloo/types.ts";
import { rankOpeners, scoreOf, type OpenerCandidate } from "./opener.ts";

const cells = (v: Record<string, number>): HeatCell[] => Object.entries(v).map(([name, affinity], i) => ({ name, affinity, lat: 41.8 + i / 100, lng: -87.7, popularity: 1 }));
const head = cells({ North: 1, West: 0.8, South: 0 });
const cand = (id: string, affinity: number, heat: Record<string, number>, extra: Partial<OpenerCandidate> = {}): OpenerCandidate => ({
  id, name: id, genre: "Rock", affinity, heat: cells(heat), estimated: false, rising: false, onRoster: false, relatedRank: 1, relatedOf: 3, ...extra,
});

test("score is fit^0.6 * reachGain^0.4", () => {
  assert.equal(scoreOf(1, 1), 1);
  assert.equal(scoreOf(0, 1), 0);
  assert.equal(scoreOf(0.81, 0.81), 0.81);
});
test("an act that brings a new crowd beats a closer match that brings none", () => {
  const rows = rankOpeners({ headliner: "H", headlinerHeat: head, candidates: [cand("same", 0.9, { North: 1, West: 0.8 }), cand("new", 0.8, { South: 1, West: 0.2 })] });
  assert.deepEqual(rows.map((r) => r.name), ["new", "same"]);
  assert.ok(rows[1].reachGain < 0.2);
  assert.deepEqual(rows[1].hoods, []);
  assert.deepEqual(rows[0].hoods, ["South"]);
  assert.match(rows[0].why, /owns South, where H runs cold/);
});
test("no candidates, or all excluded, gives an empty ranking", () => {
  assert.deepEqual(rankOpeners({ headliner: "H", headlinerHeat: head, candidates: [] }), []);
  assert.deepEqual(rankOpeners({ headliner: "H", headlinerHeat: head, candidates: [cand("x", 0.5, {})], exclude: ["X"] }), []);
});
test("ties break by fit, then by name", () => {
  const rows = rankOpeners({ headliner: "H", headlinerHeat: head, candidates: [cand("b", 0.5, {}), cand("a", 0.5, {})] });
  assert.deepEqual(rows.map((r) => r.name), ["a", "b"]);
});
test("estimated rows say so in the explanation", () => {
  const [r] = rankOpeners({ headliner: "H", headlinerHeat: head, candidates: [cand("e", 0.5, { South: 1 }, { estimated: true, relatedRank: undefined })] });
  assert.match(r.why, /^Sits outside H's closest matches/);
  assert.match(r.why, /estimated from its scene/);
});
test("property: every number stays in 0..1 for random inputs", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 50; k++) {
    const cs = Array.from({ length: 6 }, (_, i) => cand(`c${i}`, rnd(), { North: rnd(), West: rnd(), South: rnd() }, { cityAffinity: rnd() < 0.5 ? rnd() : undefined }));
    for (const r of rankOpeners({ headliner: "H", headlinerHeat: cells({ North: rnd(), West: rnd(), South: rnd() }), candidates: cs })) {
      for (const v of [r.fit, r.reachGain, r.score]) assert.ok(v >= 0 && v <= 1, `${v} out of range`);
    }
  }
});
test("the act its fans rank first keeps the top fit even when it is famous", () => {
  // live shape: affinities bunched within 0.02, and the famous act is about as popular as it is loved
  const famous = cand("famous", 0.981, {}, { relatedRank: 1, relatedOf: 4 });
  const niche = cand("niche", 0.968, {}, { relatedRank: 4, relatedOf: 4 });
  const rows = rankOpeners({ headliner: "H", headlinerHeat: head, candidates: [famous, niche], field: { related: [0.981, 0.98, 0.975, 0.968] } });
  const fit = Object.fromEntries(rows.map((r) => [r.name, r.fit]));
  assert.ok(fit.famous > fit.niche, JSON.stringify(fit));
});
test("an act that draws bigger than the headliner is demoted as a co-headliner, never dropped", () => {
  // popularity as Qloo had it on 29 Oct: Phoebe Bridgers 0.9944, Big Thief 0.9910, Lucy Dacus 0.9822
  const rows = rankOpeners({
    headliner: "Big Thief",
    headlinerPopularity: 0.991,
    headlinerHeat: head,
    candidates: [cand("Phoebe Bridgers", 0.9, { South: 1 }, { popularity: 0.9944 }), cand("Lucy Dacus", 0.8, { South: 0.8 }, { popularity: 0.9822 })],
  });
  assert.deepEqual(rows.map((r) => r.name), ["Lucy Dacus", "Phoebe Bridgers"]);
  assert.equal(rows[1].bigger, true);
  assert.equal(rows[0].bigger, undefined);
  assert.match(rows[1].why, /^Draws bigger than Big Thief, so it fits as a co-headliner\./);
  // with no popularity on either side, nobody is called bigger
  assert.equal(rankOpeners({ headliner: "H", headlinerHeat: head, candidates: [cand("x", 0.5, {}, { popularity: 0.9999 })] })[0].bigger, undefined);
});
