import assert from "node:assert/strict";
import { test } from "node:test";
import { leanOf, nameCells, neighbourhoodPoints } from "./client.ts";

const loc = (name: string, place: string | null, lat: number, lon: number) => ({ name, properties: { place }, location: { lat, lon } });
const cell = (latitude: number, longitude: number, affinity: number, popularity: number) => ({ location: { latitude, longitude }, query: { affinity, popularity } });

test("a city's neighbourhoods drop the city, suburbs, admin areas and repeats", () => {
  const hoods = neighbourhoodPoints(
    [loc("Chicago", "city", 41.84, -87.69), loc("Cook County", "county", 41.9, -87.6), loc("Lake View Township", null, 41.96, -87.66), loc("Niles", "village", 42.02, -87.8), loc("Logan Square", "quarter", 41.92, -87.7), loc("Logan Square", "quarter", 41.91, -87.68), loc("Uptown", "quarter", 41.97, -87.65)],
    "Chicago",
  );
  assert.deepEqual(hoods.map((h) => h.name), ["Logan Square", "Uptown"]);
});

test("cells take the nearest neighbourhood's name and fold by popularity", () => {
  const hoods = [
    { name: "Logan Square", lat: 41.92, lng: -87.7 },
    { name: "Uptown", lat: 41.97, lng: -87.65 },
  ];
  const out = nameCells([cell(41.921, -87.701, 1, 0.9), cell(41.919, -87.699, 0.2, 0.1), cell(41.971, -87.651, 0.5, 0), cell(42.5, -88.5, 1, 1)], hoods, 1);
  assert.deepEqual(out, [
    { name: "Logan Square", lat: 41.92, lng: -87.7, affinity: 0.92, popularity: 0.5 },
    { name: "Uptown", lat: 41.97, lng: -87.65, affinity: 0.5, popularity: 0 },
  ]);
});

test("a neighbourhood with too few cells is dropped", () => {
  const hoods = [{ name: "Garfield Ridge", lat: 41.79, lng: -87.77 }];
  assert.deepEqual(nameCells([cell(41.79, -87.77, 1, 1)], hoods), []);
});

test("a city's lean is affinity_rank weighted by popularity", () => {
  const rank = (affinity_rank: number, popularity: number) => ({ query: { affinity: 1, affinity_rank, popularity } });
  assert.deepEqual(leanOf([rank(0.9, 0.75), rank(0.5, 0.25), rank(0.1, 0)]), { affinity: 0.8, baseline: 0.5 });
  assert.equal(leanOf([]), undefined);
});

test("Jakarta's city districts and numbered blocks are no neighbourhoods", () => {
  const hoods = neighbourhoodPoints([loc("South Jakarta", null, -6.26, 106.81), loc("RW 04", null, -6.2, 106.83), loc("Menteng", null, -6.19, 106.84), loc("South Loop", null, -6.3, 106.8)], "Jakarta");
  assert.deepEqual(hoods.map((h) => h.name), ["Menteng", "South Loop"]);
});
