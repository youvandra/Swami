import assert from "node:assert/strict";
import { test } from "node:test";
import { CHICAGO_HOODS, buildDots, heat, isNamed } from "./crowdmap.ts";

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
