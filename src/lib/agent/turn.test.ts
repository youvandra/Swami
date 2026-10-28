import assert from "node:assert/strict";
import { test } from "node:test";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { FixtureQloo } from "../qloo/fixture.ts";
import { makeContext } from "../tools/context.ts";
import type { AgentEvent } from "./events.ts";
import { numbersBacked } from "./prose.ts";
import { headlinerIn, intent, plan } from "./router.ts";
import { answerCards, answerChoice } from "./choice.ts";
import { templateTurn } from "./turn.ts";
import type { ChatRequest, Choices } from "./types.ts";

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
  assert.equal(out.title, "Openers, Chicago, Mar 14 · Marlow Vane");
});

test("an ambiguous name asks with choices and runs no tools", async () => {
  const { out } = await run(req("Find an opener for Marlow in Chicago"));
  assert.equal(out.artifacts.length, 0);
  assert.equal(out.choices?.options.length, 3);
  assert.equal(out.choices?.options[2].name, "None of these");
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
  assert.match(out.text, /picked for a club-size act; give me the capacity/);
  assert.match(out.artifacts[0].subtitle, /for a club-size act/);
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
  assert.equal(numbersBacked("Score 0.90", [{ score: 0.9 }]), true);
});

// what runChat does with a reply to the cards, without the model
const answer = async (text: string, prior: { choices?: Choices; entities?: Record<string, string> }) => {
  const events: AgentEvent[] = [];
  const r = req(text, { context: { workspace: "W", role: "Promoter", cities: ["Chicago"], choices: prior.choices } });
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago" }, entities: { ...prior.entities }, onStep: (step) => events.push({ type: "step", step }) });
  const a = await answerCards(ctx, r, text, (e) => events.push(e));
  const out = a && "result" in a ? a.result : await templateTurn(ctx, a ? req(a.ask) : r, (e) => events.push(e));
  return { out, ctx };
};

test("'none of these' runs no tools, shows no cards again and asks for a hint", async () => {
  const first = (await run(req("Find an opener for Marlow in Chicago"))).out.choices!;
  for (const said of ["None of these", "no one above", "bukan yang itu", "not these"]) {
    const { out, ctx } = await answer(said, { choices: first });
    assert.equal(out.artifacts.length, 0);
    assert.equal(out.choices, undefined);
    assert.match(out.text, /another spelling/);
    assert.equal(ctx.entities["rejected:marlow"], "fa-marlow-vane,fa-marlow-tide");
  }
  // the hint searches again without the acts turned down: nothing else is called Marlow in the fixture
  const { ctx } = await answer("None of these", { choices: first });
  const retry = await answer("the one from Seoul", { entities: ctx.entities });
  assert.match(retry.out.text, /Still nothing for Marlow/);
  assert.equal(retry.out.choices, undefined);
  // and asking again by the same name never shows the rejected cards
  const again = await run(req("Find an opener for Marlow in Chicago"), ctx.entities);
  assert.equal(again.out.choices, undefined);
  assert.match(again.out.text, /could not find/);
});

test("a typed answer to the cards picks one: by order, by name, by genre", async () => {
  const first = (await run(req("Find an opener for Marlow in Chicago"))).out.choices!;
  assert.equal(answerChoice("the second one", first.options)?.kind, "pick");
  for (const [said, act] of [["the second one", "Marlow & the Tide"], ["2", "Marlow & the Tide"], ["Marlow Vane", "Marlow Vane"], ["the americana one", "Marlow & the Tide"], ["yang pertama", "Marlow Vane"]]) {
    const { out } = await answer(said, { choices: first });
    assert.equal(out.artifacts[0]?.show.headliner, act, said);
    assert.equal(out.choices, undefined);
  }
  // a new question is no answer to the cards
  assert.equal(answerChoice("Which venue fits Saint Rook in Chicago for 1,100 people?", first.options), null);
});

test("a hint that fits one act resolves it and answers the original question", async () => {
  const first = (await run(req("Find an opener for Marlow in Chicago"))).out.choices!;
  // turn down only the duo: the hint "folk" then leaves Marlow Vane
  const { ctx } = await answer("None of these", { choices: { ...first, options: first.options.filter((o) => o.id !== "fa-marlow-vane") } });
  const { out } = await answer("the indie folk band", { entities: ctx.entities });
  assert.deepEqual(out.artifacts.map((a) => a.type), ["opener_ranking", "crowd_map"]);
  assert.equal(out.artifacts[0].show.headliner, "Marlow Vane");
});

// A city where Qloo tags concert halls and stadiums but no "music venue", like Jakarta on 29 Oct.
class NoMusicVenueTag extends FixtureQloo {
  override async insights(q: Parameters<FixtureQloo["insights"]>[0]) {
    const got = await super.insights({ ...q, tags: q.type === "place" ? undefined : q.tags });
    if (q.type !== "place") return got;
    const tag = q.tags?.[0] ?? "";
    if (/concert_hall/.test(tag)) return got.slice(0, 2);
    if (/stadium/.test(tag)) return got.slice(2, 4);
    return [];
  }
}

test("venues fall back through tags and say which ones answered", async () => {
  const ctx = makeContext(new NoMusicVenueTag(FAKE_GRAPH), { defaults: { city: "Chicago" } });
  const out = await templateTurn(ctx, req("Which venue fits Marlow Vane in Chicago?"), () => {});
  const v = out.artifacts[0];
  if (v?.type !== "venues") return assert.fail(out.text);
  assert.match(v.subtitle, /concert halls ranked by audience fit · for a club-size act/);
  assert.match(out.text, /^Qloo has no music venues tagged in Chicago, so these are concert halls\./);
  // a stated stadium capacity starts from stadiums
  const big = await templateTurn(makeContext(new NoMusicVenueTag(FAKE_GRAPH), { defaults: { city: "Chicago" } }), req("Which venue fits Marlow Vane in Chicago for 40,000 people?"), () => {});
  assert.match(big.artifacts[0]?.subtitle ?? "", /stadiums.*concert halls|stadiums/);
  assert.doesNotMatch(big.text, /Qloo has no/);
});

test("a leg outside the US says routing covers US cities", async () => {
  const { out } = await run(req("Which cities should Marlow Vane play on an Asia leg in March?"));
  assert.equal(out.artifacts.length, 0);
  assert.match(out.text, /US cities for now, and Asia is outside them/);
});
