import assert from "node:assert/strict";
import { test } from "node:test";
import { clamp01, fits, listing, minmax, ordinal } from "./normalize.ts";

test("minmax spreads a set over 0..1", () => assert.deepEqual(minmax([2, 4, 6]), [0, 0.5, 1]));
test("minmax of an empty set is empty, of a flat set is all ones", () => {
  assert.deepEqual(minmax([]), []);
  assert.deepEqual(minmax([3, 3]), [1, 1]);
});
test("fits reward lift over raw affinity", () => {
  const [famous, specific] = fits([
    { affinity: 0.9, baseline: 0.85 },
    { affinity: 0.8, baseline: 0.3 },
  ]);
  assert.ok(specific > famous);
});
test("fits without baselines fall back to half the affinity", () => assert.deepEqual(fits([{ affinity: 0.8 }]), [0.4]));
test("clamp01 handles NaN and out-of-range", () => assert.deepEqual([clamp01(NaN), clamp01(-1), clamp01(2), clamp01(0.3)], [0, 0, 1, 0.3]));
test("ordinals and listings read like English", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
  assert.equal(listing(["A", "B", "C"]), "A, B and C");
  assert.equal(listing(["A"]), "A");
  assert.equal(listing([]), "");
});
