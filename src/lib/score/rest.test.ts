import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAudience, shares, under30, womenShare } from "./audience.ts";
import { rankPartners } from "./partners.ts";
import { MIN_LIFT, rankSponsors } from "./sponsors.ts";
import { rankVenues } from "./venues.ts";

test("venues: best fit first, notes follow the size", () => {
  const v = rankVenues("H", 1000, [
    { name: "Small", capacity: 500, tags: [], affinity: 0.5 },
    { name: "Right", capacity: 1100, tags: ["Standing"], affinity: 0.9 },
    { name: "Huge", capacity: 3000, tags: [], affinity: 0.6 },
  ]);
  assert.deepEqual(v.map((x) => x.name), ["Right", "Huge", "Small"]);
  assert.match(v[0].note, /right size/);
  assert.match(v[1].note, /Too large/);
  assert.match(v[2].note, /Smaller room/);
});
test("venues: unknown capacity is said, never invented", () => {
  const [v] = rankVenues("H", 1000, [{ name: "X", tags: [], affinity: 0.5 }]);
  assert.equal(v.capacity, undefined);
  assert.match(v.note, /Capacity unknown/);
  assert.deepEqual(rankVenues("H", 1000, []), []);
});
test("venues and partners: the place the fans rank first gets the top fit, however popular it is", () => {
  // Big Thief in Chicago, 29 Oct: Thalia Hall tops the fans' list and is also one of the city's best-known rooms
  const v = rankVenues("Big Thief", 1000, [
    { name: "Thalia Hall", tags: [], affinity: 0.963 },
    { name: "Lincoln Hall", tags: [], affinity: 0.96 },
    { name: "Congress Theater", tags: [], affinity: 0.951 },
  ]);
  assert.deepEqual(v.map((x) => [x.name, x.fit]), [["Thalia Hall", 1], ["Lincoln Hall", 0.67], ["Congress Theater", 0.33]]);
  const p = rankPartners([{ name: "Thalia Hall", kind: "Bar", affinity: 0.963 }, { name: "Bunny Hutch", kind: "Bar", affinity: 0.937 }], []);
  assert.deepEqual(p.map((x) => x.name), ["Thalia Hall", "Bunny Hutch"]);
});
test("partners inside the added-crowd hoods come first, angles vary per kind", () => {
  const p = rankPartners(
    [
      { name: "Out", kind: "Bar", hood: "Rich", affinity: 0.95 },
      { name: "In1", kind: "Bar", hood: "New", affinity: 0.7 },
      { name: "In2", kind: "Bar", hood: "New", affinity: 0.6 },
    ],
    ["New"],
  );
  assert.deepEqual(p.map((x) => x.name), ["In1", "In2", "Out"]);
  assert.notEqual(p[0].angle, p[1].angle);
  assert.deepEqual(rankPartners([], ["New"]), []);
});
test("sponsors: lift is seeded over baseline, weak lifts are dropped", () => {
  const s = rankSponsors([
    { name: "Strong", category: "Beverage", affinity: 0.85, baseline: 0.25 },
    { name: "Flat", category: "Retail", affinity: 0.6, baseline: 0.6 },
    { name: "Slight", category: "Retail", affinity: 0.66, baseline: 0.6 },
    { name: "NoBase", category: "Retail", affinity: 0.9 },
  ]);
  assert.deepEqual(s.map((x) => [x.brand, x.lift]), [["Strong", 3.4], ["Slight", 1.1]]);
  assert.match(s[1].pitch, /more than its overall popularity/);
  assert.equal(s[0].fit, 1);
  assert.match(s[0].pitch, /3\.4×/);
  assert.ok(MIN_LIFT > 1);
});
test("sponsors: a broad fan base falls back to the fans' top picks, marked broad", () => {
  const s = rankSponsors([
    { name: "Mall", category: "Retail", affinity: 0.97, baseline: 0.96 },
    { name: "Shoes", category: "Fashion", affinity: 0.95, baseline: 0.95 },
    { name: "NoBase", category: "Retail", affinity: 0.9 },
  ]);
  assert.deepEqual(s.map((x) => x.brand), ["Mall", "Shoes", "NoBase"]);
  assert.ok(s.every((x) => x.broad && x.lift > 0));
  assert.match(s[0].pitch, /broad/);
  assert.equal(s[0].fit, 1);
});
test("audience: shares sum to 1, missing data falls back to the base", () => {
  for (const d of [null, { age: { "24_and_younger": 0.5, "55_and_older": -0.9 }, gender: { female: 0.2, male: -0.2 } }]) {
    const sum = shares(d).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, String(sum));
  }
  assert.equal(womenShare(null), 0.5);
  assert.equal(womenShare({ age: {}, gender: { female: 0.2, male: -0.2 } }), 0.6);
});
test("audience: a younger act shows more under-30s", () => {
  const a = buildAudience({ age: { "24_and_younger": -0.4 }, gender: {} }, { age: { "24_and_younger": 0.5 }, gender: {} }, []);
  assert.ok(under30(a, "opener") > under30(a, "headliner"));
  assert.equal(a.ages.length, 5);
});
