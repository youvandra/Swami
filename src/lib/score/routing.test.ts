import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES, cityIn, findCity, haversine } from "./cities.ts";
import { inRegion, roomBand, routeTour } from "./routing.ts";

const c = (n: string) => findCity(n)!;

test("haversine: Chicago to Milwaukee is about 82 miles", () => {
  const d = haversine(c("Chicago"), c("Milwaukee"));
  assert.ok(d > 75 && d < 90, String(d));
});
test("cities are found in free text, longest name first", () => {
  assert.equal(cityIn("a show in Kansas City in May")?.name, "Kansas City");
  assert.equal(cityIn("find me an opener in nyc")?.name, "New York");
  assert.equal(cityIn("no place named here"), undefined);
});
test("the leg starts at the anchor and walks to the nearest next city", () => {
  const stops = routeTour({
    anchor: "Chicago",
    capacity: 1000,
    cities: [{ city: c("Detroit"), affinity: 0.8, baseline: 0.3 }, { city: c("Chicago"), affinity: 0.9, baseline: 0.3 }, { city: c("Milwaukee"), affinity: 0.7, baseline: 0.3 }],
  });
  assert.deepEqual(stops.map((s) => s.city), ["Chicago", "Milwaukee", "Detroit"]);
  assert.equal(stops[0].milesFromPrev, 0);
  assert.match(stops[0].note, /^Anchor date/);
});
test("an empty list routes to nothing, and stops caps the leg", () => {
  assert.deepEqual(routeTour({ cities: [], capacity: 500 }), []);
  const all = inRegion(CITIES, "midwest").map((city, i) => ({ city, affinity: 0.4 + i / 40 }));
  assert.equal(routeTour({ cities: all, capacity: 800, stops: 5 }).length, 5);
});
test("room bands grow with affinity", () => {
  assert.equal(roomBand(1000, 1), "1,000–1,300");
  assert.equal(roomBand(1000, 0), "500–600");
});
test("unknown regions keep every city", () => assert.equal(inRegion(CITIES, "Atlantis").length, CITIES.length));
