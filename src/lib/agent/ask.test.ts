import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { FixtureQloo } from "../qloo/fixture.ts";
import { makeContext } from "../tools/context.ts";
import * as T from "../tools/tools.ts";
import { askFor } from "./ask.ts";
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
