import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { FixtureQloo } from "./fixture.ts";
import { genreTag } from "./urns.ts";

const q = () => new FixtureQloo(FAKE_GRAPH);

test("search matches every word and ranks by popularity", async () => {
  const hits = await q().search("marlow", "artist");
  assert.deepEqual(hits.map((h) => h.name), ["Marlow Vane", "Marlow & the Tide"]);
  assert.equal((await q().search("nobody here", "artist")).length, 0);
});

test("insights exclude the seed and keep places inside the city", async () => {
  const acts = await q().insights({ type: "artist", seeds: ["fa-marlow-vane"] });
  assert.ok(acts.length >= 8);
  assert.ok(!acts.some((a) => a.id === "fa-marlow-vane"));
  assert.equal((await q().insights({ type: "place", seeds: ["fa-marlow-vane"], city: "Austin" })).length, 0);
});

test("heat: small acts have none, their scene does, unknown cities are empty", async () => {
  assert.equal((await q().heatmap({ entity: "fa-copper-hours" }, "Chicago")).length, 0);
  assert.equal((await q().heatmap({ tag: genreTag("garage") }, "Chicago")).length, 7);
  assert.equal((await q().heatmap({ entity: "fa-marlow-vane" }, "Atlantis")).length, 0);
  const austin = await q().heatmap({ entity: "fa-marlow-vane" }, "austin");
  assert.equal(austin.length, 7);
  assert.deepEqual(austin, await q().heatmap({ entity: "fa-marlow-vane" }, "Austin"));
});

test("the source counts its calls", async () => {
  const s = q();
  await s.search("marlow", "artist");
  await s.demographics("fa-halcyon-drive");
  assert.equal(s.calls, 2);
});
