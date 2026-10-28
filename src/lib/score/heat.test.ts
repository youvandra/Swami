import assert from "node:assert/strict";
import { test } from "node:test";
import type { HeatCell } from "../qloo/types.ts";
import { addedCrowd, hoodHeat, projector, toHoods, topAdded } from "./heat.ts";

const cell = (name: string, affinity: number, lat = 41.9, lng = -87.7, popularity = 1): HeatCell => ({ name, affinity, lat, lng, popularity });

test("added crowd: overlap cancels, never negative", () => {
  assert.equal(addedCrowd(0, 0.8), 0.8);
  assert.equal(addedCrowd(1, 0.5), 0);
  assert.ok(Math.abs(addedCrowd(0.5, 0.9) - 0.45) < 1e-9);
});
test("each layer is scaled so its hottest neighbourhood is 1", () => {
  const h = hoodHeat([cell("A", 0.2), cell("B", 0.4)]);
  assert.equal(h.get("B")!.value, 1);
  assert.equal(h.get("A")!.value, 0.5);
  assert.equal(hoodHeat([]).size, 0);
});
test("cells without names get a stable positional key", () => {
  const h = hoodHeat([{ lat: 41.91234, lng: -87.6, affinity: 1, popularity: 1 }]);
  assert.deepEqual([...h.keys()], ["41.912,-87.600"]);
});
test("Chicago uses its fixed frame; other cities frame their own cells", () => {
  const at = projector("Chicago", []);
  assert.deepEqual(at({ lat: 42.02, lng: -87.94 }), { x: 0, y: 0 });
  const austin = projector("Austin", [{ lat: 30.2, lng: -97.8 }, { lat: 30.3, lng: -97.7 }]);
  const p = austin({ lat: 30.25, lng: -97.75 });
  assert.ok(p.x > 200 && p.x < 260 && p.y > 120 && p.y < 180);
});
test("toHoods joins both sides; a side without a cell counts zero", () => {
  const hoods = toHoods("Chicago", [cell("A", 1)], [cell("B", 1, 41.8)]);
  assert.deepEqual(hoods.map((h) => [h.name, h.headliner, h.opener]), [["A", 1, 0], ["B", 0, 1]]);
});
test("topAdded ranks by weighted gain and drops overlap", () => {
  const head = [cell("Home", 1), cell("Away", 0)];
  const open = [cell("Home", 1), cell("Away", 0.9, 41.8, -87.7, 0.5), cell("Far", 0.6, 41.7, -87.6, 1)];
  assert.deepEqual(topAdded(head, open).map((x) => x.name), ["Far", "Away"]);
});
