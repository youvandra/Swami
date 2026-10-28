import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { FixtureQloo } from "../qloo/fixture.ts";
import { makeContext } from "../tools/context.ts";
import * as T from "../tools/tools.ts";
import { askFor, askMap, findArtifactFor } from "./ask.ts";
import { plan, type Kind } from "./router.ts";

const KIND: Record<string, Kind> = { opener_ranking: "opener", crowd_map: "map", routing: "routing", venues: "venues", partners: "partners", sponsors: "sponsors", audience: "audience", proposal: "proposal", email: "email" };

test("running a saved result again asks for the same kind, show and opener", async () => {
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago", date: "Mar 14", venue: "The Thalia Room", capacity: 1100 } });
  const H = { headliner: "Marlow Vane" };
  const made = await Promise.all([
    T.rankOpenersTool(ctx, H), T.crowdMapTool(ctx, H), T.routeTourTool(ctx, { ...H, region: "Midwest" }), T.findVenuesTool(ctx, H), T.findPartnersTool(ctx, H),
    T.matchSponsorsTool(ctx, H), T.audienceTool(ctx, H), T.draftProposalTool(ctx, { ...H, template: "memo" }), T.draftEmailTool(ctx, { ...H, kind: "venue" }),
  ]);
  for (const { artifact } of made) {
    const p = plan(askFor(artifact!), "auto");
    assert.equal(p.kind, KIND[artifact!.type], askFor(artifact!));
    assert.equal(p.headliner, "Marlow Vane", askFor(artifact!));
    if (artifact!.type === "audience" || artifact!.type === "crowd_map") assert.equal(p.input.opener, artifact!.opener);
    if (artifact!.type === "proposal") assert.equal(p.input.template, "memo");
  }
});

test("a row's crowd map is that act's map for that show, never the chat's first map", async () => {
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago", date: "Mar 14", venue: "The Thalia Room", capacity: 1100 } });
  const ranking = (await T.rankOpenersTool(ctx, { headliner: "Marlow Vane" })).artifact!;
  assert.equal(ranking.type, "opener_ranking");
  if (ranking.type !== "opener_ranking") return;
  const [first, , third] = ranking.rows;
  const mapOf = async (opener: string, city = "Chicago") => (await T.crowdMapTool(ctx, { headliner: "Marlow Vane", opener, city })).artifact!;
  const arts = [ranking, await mapOf(first.name), await mapOf(third.name, "Austin")];
  assert.equal(findArtifactFor(arts, { type: "crowd_map", headliner: "Marlow Vane", city: "Chicago", opener: third.name }), undefined, "row 3's Austin map is no Chicago map");
  const chi = await mapOf(third.name);
  const found = findArtifactFor([...arts, chi], { type: "crowd_map", headliner: "marlow vane", city: "Chicago", opener: third.name });
  assert.equal(found?.id, chi.id);
  // the ask for a missing map names the clicked act, and the router hears it as that act's map
  const p = plan(askMap(ranking.show, third.name), "auto");
  assert.deepEqual(p.tools, ["crowd_map"]);
  assert.equal(p.input.opener, third.name);
});
