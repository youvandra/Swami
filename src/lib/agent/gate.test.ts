import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { FixtureQloo } from "../qloo/fixture.ts";
import { makeContext } from "../tools/context.ts";
import { draftProposalTool } from "../tools/tools.ts";
import type { AgentEvent } from "./events.ts";
import { gate } from "./gate.ts";
import { plan } from "./router.ts";
import type { ChatContext, ChatRequest } from "./types.ts";

const ask = async (text: string, extra: Partial<ChatContext> = {}) => {
  const context: ChatContext = { workspace: "Northside Live", role: "Promoter", cities: ["Chicago"], ...extra };
  const req: ChatRequest = { conversationId: "c", mode: "auto", messages: [{ role: "user", text }], context };
  const events: AgentEvent[] = [];
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago" } });
  return { out: await gate(ctx, req, text, (e) => events.push(e)), events };
};

test("gate: no artist and no show asks which one, with the workspace's artists as cards", async () => {
  const { out } = await ask("Write a proposal", { artists: ["Marlow Vane"] });
  assert.ok(out);
  assert.equal(out.artifacts.length, 0);
  assert.deepEqual(out.choices?.options.map((o) => o.name), ["Marlow Vane"]);
  assert.match(out.choices!.options[0].reply, /^Write a proposal for Marlow Vane\.$/);
  const bare = await ask("Write a proposal");
  assert.match(bare.out!.text, /Which artist is this for\?/);
  assert.equal(bare.out!.choices, undefined);
});

test("gate: a proposal with no opener shows the ranking and asks which act", async () => {
  const { out, events } = await ask("Write a proposal for Marlow Vane in Chicago, Mar 14.");
  assert.ok(out);
  assert.deepEqual(out.artifacts.map((a) => a.type), ["opener_ranking"]);
  assert.ok(out.choices && out.choices.options.length > 0 && out.choices.options.length <= 3);
  for (const o of out.choices.options) {
    assert.match(o.reply, new RegExp(`^Write a proposal for Marlow Vane with ${o.name} in Chicago, Mar 14`));
    // the card's reply names the opener the way the router reads it, so it passes the gate next time
    assert.equal(plan(o.reply, "auto").input.opener, o.name);
    assert.doesNotMatch(o.id, /^unknown:/);
  }
  assert.deepEqual(events.map((e) => e.type).filter((t) => t !== "step"), ["artifact", "text", "choices"]);
});

test("gate: steps aside once the opener is known", async () => {
  assert.equal((await ask("Write a proposal for Marlow Vane with Halcyon Drive in Chicago.")).out, null);
  const last = { headliner: "Marlow Vane", city: "Chicago", date: "Mar 14", opener: "Halcyon Drive" };
  assert.equal((await ask("Now write the proposal", { last })).out, null);
  assert.equal((await ask("Find an opener for Marlow Vane in Chicago.")).out, null);
  assert.equal((await ask("Which venue fits Marlow Vane in Chicago?")).out, null);
});

test("proposal: the chosen opener leads the picks, and zero scores stay out", async () => {
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago" } });
  const top = await draftProposalTool(ctx, { headliner: "Marlow Vane", city: "Chicago" });
  if (top.artifact?.type !== "proposal") return assert.fail();
  const second = top.artifact.picks[1].name;
  const chosen = await draftProposalTool(ctx, { headliner: "Marlow Vane", city: "Chicago", opener: second });
  if (chosen.artifact?.type !== "proposal") return assert.fail();
  assert.equal(chosen.artifact.picks[0].name, second);
  assert.ok(chosen.artifact.picks.every((p) => p.score > 0));
});
