import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { FixtureQloo } from "../qloo/fixture.ts";
import { makeContext } from "../tools/context.ts";
import type { AgentEvent } from "./events.ts";
import { numbersBacked } from "./prose.ts";
import { headlinerIn, intent, plan } from "./router.ts";
import { templateTurn } from "./turn.ts";
import type { ChatRequest } from "./types.ts";

const req = (text: string, extra: Partial<ChatRequest> = {}): ChatRequest => ({ conversationId: "c", mode: "auto", messages: [{ role: "user", text }], ...extra });
const run = async (r: ChatRequest, entities: Record<string, string> = {}) => {
  const events: AgentEvent[] = [];
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago" }, entities, onStep: (step) => events.push({ type: "step", step }) });
  const out = await templateTurn(ctx, r, (e) => events.push(e));
  return { out, events, ctx };
};

test("router: intents and names", () => {
  assert.equal(intent("Draft an email to the venue", "auto"), "email");
  assert.equal(intent("Which cities on a Midwest leg?", "auto"), "routing");
  assert.equal(intent("anything", "sponsors"), "sponsors");
  assert.equal(headlinerIn("Find an opener for Marlow Vane in Chicago, Mar 14."), "Marlow Vane");
  assert.equal(headlinerIn("Find sponsors whose customers love Saint Rook, for the show"), "Saint Rook");
  assert.equal(headlinerIn("an opener for Chicago"), undefined);
  assert.equal(headlinerIn("Which venue fits Marlow Vane in Chicago?"), "Marlow Vane");
  assert.equal(headlinerIn("Which cities should Marlow Vane play?"), "Marlow Vane");
  const a = plan("Who is the audience for Marlow Vane and Halcyon Drive in Chicago?", "auto");
  assert.deepEqual([a.kind, a.headliner, a.input.opener], ["audience", "Marlow Vane", "Halcyon Drive"]);
  assert.equal(plan("Find co-promo partners in Chicago for Marlow Vane with Halcyon Drive.", "auto").input.opener, "Halcyon Drive");
  const p = plan("Which cities should Marlow Vane play on a Midwest leg in March? Route for Marlow Vane", "auto");
  assert.deepEqual([p.kind, p.input.region, p.input.date], ["routing", "Midwest", "March"]);
});

test("a full opener turn streams steps, artifacts and text in order", async () => {
  const { out, events } = await run(req("Find an opener for Marlow Vane in Chicago, Mar 14."));
  assert.deepEqual(out.artifacts.map((a) => a.type), ["opener_ranking", "crowd_map"]);
  const kinds = events.map((e) => e.type);
  assert.ok(kinds.indexOf("step") < kinds.indexOf("artifact"));
  assert.equal(kinds[kinds.length - 1], "text");
  assert.match(out.text, /Halcyon Drive leads/);
  assert.ok(numbersBacked(out.text, out.outcomes));
  assert.equal(out.title, "Chicago, Mar 14 · openers");
});

test("an ambiguous name asks with choices and runs no tools", async () => {
  const { out } = await run(req("Find an opener for Marlow in Chicago"));
  assert.equal(out.artifacts.length, 0);
  assert.equal(out.choices?.options.length, 2);
  assert.equal(out.choices?.key, "marlow");
  assert.equal(out.choices?.options[1].reply, "Find an opener for Marlow & the Tide in Chicago");
});

test("a remembered choice skips the question", async () => {
  const { out } = await run(req("Find an opener for Marlow in Chicago"), { marlow: "fa-marlow-tide" });
  assert.equal(out.choices, undefined);
  assert.equal(out.artifacts[0]?.show.headliner, "Marlow & the Tide");
});

test("an attached roster limits the ranking to its acts", async () => {
  const { out } = await run(req("Find an opener for Marlow Vane in Chicago. Roster only.", { context: { workspace: "W", role: "Promoter", cities: ["Chicago"], roster: { name: "Spring", acts: ["Halcyon Drive", "Fieldwork"] } } }));
  const a = out.artifacts[0];
  if (a?.type !== "opener_ranking") return assert.fail();
  assert.deepEqual(a.rows.map((r) => r.name), ["Halcyon Drive", "Fieldwork"]);
});

test("a follow-up keeps the chat's show and opener; a new name starts over", async () => {
  const last = { headliner: "Marlow Vane", city: "Chicago", date: "Mar 14", opener: "Pia Marsh" };
  const ctx = { workspace: "W", role: "Promoter", cities: ["Austin"], last };
  const p = plan("now who comes to see them?", "auto", ctx);
  assert.deepEqual([p.kind, p.headliner, p.input.city, p.input.date, p.input.opener], ["audience", "Marlow Vane", "Chicago", "Mar 14", "Pia Marsh"]);
  const fresh = plan("Find an opener for Saint Rook", "auto", ctx);
  assert.deepEqual([fresh.headliner, fresh.input.city], ["Saint Rook", undefined]);
});

test("capacity is read from the ask, and an assumed one is said", async () => {
  assert.equal(plan("Which venue fits Marlow Vane in Chicago for 1,500 people?", "auto").input.capacity, 1500);
  assert.equal(plan("Rooms for Marlow Vane, 800-cap", "auto").input.capacity, 800);
  assert.equal(plan("Rooms for Marlow Vane on Mar 14", "auto").input.capacity, undefined);
  const { out } = await run(req("Which venue fits Marlow Vane in Chicago?"));
  assert.match(out.text, /assume a 1,000-cap show/);
  assert.match(out.artifacts[0].subtitle, /sized against 1,000 cap/);
});

test("drop and without re-rank the last show without those acts", async () => {
  const last = { headliner: "Marlow Vane", city: "Chicago", date: "Mar 14", opener: "Halcyon Drive" };
  const p = plan("Drop Halcyon Drive and Pia Marsh", "auto", { workspace: "W", role: "P", cities: [], last });
  assert.deepEqual([p.kind, p.headliner, p.input.exclude], ["opener", "Marlow Vane", ["Halcyon Drive", "Pia Marsh"]]);
  const { out } = await run(req("Without Halcyon Drive, who should open?", { context: { workspace: "W", role: "P", cities: [], last } }));
  const a = out.artifacts[0];
  if (a?.type !== "opener_ranking") return assert.fail();
  assert.ok(!a.rows.some((r) => r.name === "Halcyon Drive"));
  assert.notEqual(out.artifacts[1]?.type === "crowd_map" && out.artifacts[1].opener, "Halcyon Drive");
});

test("what about / same for repeat the last kind of answer", () => {
  const last = { headliner: "Marlow Vane", city: "Chicago", date: "Mar 14", kind: "sponsors" as const };
  const c = { workspace: "W", role: "P", cities: [], last };
  const a = plan("What about Austin?", "auto", c);
  assert.deepEqual([a.kind, a.headliner, a.input.city], ["sponsors", "Marlow Vane", "Austin"]);
  const b = plan("Same for Saint Rook", "auto", c);
  assert.deepEqual([b.kind, b.headliner], ["sponsors", "Saint Rook"]);
  assert.equal(plan("What about venues?", "auto", c).kind, "venues");
});

test("no headliner anywhere asks for one; the project's headliner fills in", async () => {
  assert.match((await run(req("find me an opener"))).out.text, /Which artist/);
  const { out } = await run(req("who should open?", { context: { workspace: "W", role: "Promoter", cities: [], project: { headliner: "Marlow Vane", city: "Chicago", date: "Mar 14", venue: "The Thalia Room", capacity: 1100 } } }));
  assert.equal(out.artifacts[0]?.type, "opener_ranking");
});

test("a failed tool is said plainly while the others still return", async () => {
  const { out } = await run(req("Find an opener for Marlow Vane in Denver"));
  assert.deepEqual(out.artifacts.map((a) => a.type), ["opener_ranking"]);
  assert.match(out.text, /No neighbourhood heat for Denver yet/);
});

test("numbers the tools never produced are caught", () => {
  assert.equal(numbersBacked("Score 0.92, 52% women", [{ score: 0.92, women: 0.52 }]), true);
  assert.equal(numbersBacked("Sells 4,000 tickets", [{ score: 0.92 }]), false);
});
