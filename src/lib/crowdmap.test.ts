import assert from "node:assert/strict";
import { test } from "node:test";
import { CHICAGO_HOODS, MAP_W, buildDots, heat, isNamed, placePins } from "./crowdmap.ts";

test("positional cell names get no label", () => {
  assert.equal(isNamed({ name: "41.912,-87.600", x: 0, y: 0, headliner: 0, opener: 0 }), false);
  assert.equal(isNamed(CHICAGO_HOODS[0]), true);
});

test("dense cells stay below saturation", () => {
  const cells = Array.from({ length: 60 }, (_, i) => ({ name: `${i}`, x: 100 + (i % 10) * 20, y: 80 + Math.floor(i / 10) * 20, headliner: 0, opener: 0.5 }));
  assert.ok(heat(cells, "opener", 190, 130) <= 0.5);
});

test("other cities draw their dots only near their own neighbourhoods", () => {
  const one = [{ name: "A", x: 230, y: 150, headliner: 1, opener: 0 }];
  const dots = buildDots(one, "headliner", "Austin");
  assert.ok(dots.length > 0 && dots.every((d) => Math.hypot(d.x - 230, d.y - 150) < 90));
  assert.ok(buildDots(CHICAGO_HOODS, "gain", "Chicago").length > dots.length);
});

test("pin labels never overlap and stay on the map", () => {
  const pins = placePins([
    { name: "Gold Coast Historic District", x: 400, y: 160 },
    { name: "Streeterville", x: 402, y: 164 },
    { name: "Magnificent Mile", x: 404, y: 166 },
    { name: "West Ridge", x: 330, y: 20 },
  ]);
  const gold = pins.find((p) => p.name.startsWith("Gold"));
  assert.equal(gold?.anchor, "end");
  assert.ok(pins.every((p) => p.anchor === "end" || p.tx + p.name.length * 4.6 <= MAP_W));
  // the two names stacked on the first one's spot are dropped, not drawn over it
  assert.deepEqual(pins.map((p) => p.name), ["Gold Coast Historic District", "West Ridge"]);
});
