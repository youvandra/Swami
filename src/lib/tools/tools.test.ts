import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { artifactSchema } from "../agent/artifact.schema.ts";
import { FixtureQloo } from "../qloo/fixture.ts";
import { makeContext } from "./context.ts";
import * as T from "./tools.ts";

const ctx = () => makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago", date: "Mar 14", venue: "The Thalia Room", capacity: 1100 }, workspace: "Northside Live" });
const valid = (r: T.ToolResult) => {
  const parsed = artifactSchema.safeParse(r.artifact);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3)));
  return r.artifact!;
};
const H = { headliner: "Marlow Vane" };

test("search flags a name two artists share", async () => {
  const r = await T.searchArtist(ctx(), { name: "Marlow" });
  assert.equal(r.candidates.length, 2);
  assert.equal(r.ambiguous, true);
  assert.equal((await T.searchArtist(ctx(), { name: "Marlow Vane" })).ambiguous, false);
});

test("rank_openers: ranks related acts with real steps", async () => {
  const c = ctx();
  const a = valid(await T.rankOpenersTool(c, H));
  assert.equal(a.type, "opener_ranking");
  if (a.type !== "opener_ranking") return;
  assert.ok(a.rows.length >= 6);
  assert.equal(a.rows[0].name, "Halcyon Drive");
  assert.ok(a.rows.some((r) => r.estimated));
  assert.ok(c.steps.every((s) => s.status === "done" && s.ms >= 0));
});

test("rank_openers: a roster limits the field and keeps unknown acts, marked", async () => {
  const a = valid(await T.rankOpenersTool(ctx(), { ...H, roster: { name: "Spring", acts: ["Halcyon Drive", "Fieldwork", "Nobody Yet"] } }));
  if (a.type !== "opener_ranking") return assert.fail();
  assert.deepEqual(a.rows.map((r) => r.name).sort(), ["Fieldwork", "Halcyon Drive", "Nobody Yet"]);
  assert.ok(a.rows.every((r) => r.onRoster));
  const unknown = a.rows.find((r) => r.name === "Nobody Yet")!;
  assert.equal(unknown.estimated, true);
  assert.equal(a.rows[a.rows.length - 1].name, "Nobody Yet");
});

test("crowd_map, partners, audience follow the top pick", async () => {
  const c = ctx();
  const map = valid(await T.crowdMapTool(c, H));
  if (map.type !== "crowd_map") return assert.fail();
  assert.equal(map.opener, "Halcyon Drive");
  assert.equal(map.hoods.length, 7);
  const p = valid(await T.findPartnersTool(c, H));
  if (p.type !== "partners") return assert.fail();
  assert.ok(["Logan Square", "Pilsen", "Hyde Park", "Avondale"].includes(p.partners[0].hood));
  valid(await T.audienceTool(c, H));
});

test("a city without data fails the map step plainly", async () => {
  const c = ctx();
  await assert.rejects(T.crowdMapTool(c, { ...H, city: "Denver" }), /No neighbourhood heat for Denver/);
  assert.equal(c.steps[c.steps.length - 1].status, "done");
});

test("routing, venues, sponsors", async () => {
  const r = valid(await T.routeTourTool(ctx(), { ...H, region: "midwest" }));
  if (r.type !== "routing") return assert.fail();
  assert.equal(r.stops[0].city, "Chicago");
  assert.equal(r.stops.length, 8);
  const v = valid(await T.findVenuesTool(ctx(), H));
  if (v.type !== "venues") return assert.fail();
  assert.equal(v.venues[0].name, "The Thalia Room");
  const s = valid(await T.matchSponsorsTool(ctx(), H));
  if (s.type !== "sponsors") return assert.fail();
  assert.equal(s.sponsors[0].brand, "Northwind Cold Brew");
  assert.ok(!s.sponsors.some((x) => x.brand === "Megamart"));
});

test("proposal and every email kind", async () => {
  for (const template of ["promoter", "sponsor", "memo"] as const) {
    const p = valid(await T.draftProposalTool(ctx(), { ...H, template }));
    if (p.type !== "proposal") return assert.fail();
    assert.equal(p.picks[0].name, "Halcyon Drive");
    assert.ok(!/Logan Square, Pilsen and Avondale/.test(JSON.stringify(p.sections)) || p.facts!.hoods.length > 0);
  }
  for (const kind of ["opener", "venue", "partner", "sponsor"] as const) {
    const e = valid(await T.draftEmailTool(ctx(), { ...H, kind }));
    if (e.type !== "email") return assert.fail();
    assert.match(e.body, /Northside Live/);
  }
});

test("one ranking feeds every follow-up in a run", async () => {
  const q = new FixtureQloo(FAKE_GRAPH);
  const c = makeContext(q, { defaults: { city: "Chicago" } });
  await T.rankOpenersTool(c, H);
  const after = q.calls;
  await T.crowdMapTool(c, H);
  assert.equal(q.calls, after);
});
