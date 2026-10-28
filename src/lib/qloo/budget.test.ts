import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { budgeted, slowed } from "./budget.ts";
import { FixtureQloo } from "./fixture.ts";

test("calls past the budget throw a plain message", async () => {
  const q = budgeted(new FixtureQloo(FAKE_GRAPH), 2);
  await q.search("marlow", "artist");
  await q.tags("bar");
  await assert.rejects(Promise.resolve().then(() => q.search("x", "artist")), /more than 2 taste-graph calls/);
  assert.equal(q.calls, 2);
});

test("a slowed source answers the same, later", async () => {
  const fast = new FixtureQloo(FAKE_GRAPH);
  const slow = slowed(new FixtureQloo(FAKE_GRAPH), 30);
  const t0 = performance.now();
  assert.deepEqual(await slow.search("marlow", "artist"), await fast.search("marlow", "artist"));
  assert.ok(performance.now() - t0 >= 25);
});
