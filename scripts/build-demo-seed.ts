// Rebuilds the demo chats a fresh browser starts with, by running the real tools on the fake fixture.
// Run: node scripts/build-demo-seed.ts. Output is FAKE data, labelled as such in the app.

import { writeFileSync } from "node:fs";
import { FAKE_GRAPH } from "../fixtures/fake/graph.ts";
import { templateTurn } from "../src/lib/agent/turn.ts";
import type { ChatContext } from "../src/lib/agent/types.ts";
import { FixtureQloo } from "../src/lib/qloo/fixture.ts";
import { makeContext } from "../src/lib/tools/context.ts";

const project = { headliner: "Marlow Vane", city: "Chicago", date: "Mar 14", venue: "The Thalia Room", capacity: 1100 };
const roster = { name: "Northlight Agency · spring", acts: ["Halcyon Drive", "The Low Orchard", "Copper Hours", "Fieldwork", "Glass Meridian"] };
const asks: { id: string; text: string; context: ChatContext }[] = [
  { id: "demo", text: "Find an opener for Marlow Vane in Chicago, Mar 14. Roster only.", context: { workspace: "Northside Live", role: "Promoter or venue", cities: ["Chicago"], project, roster } },
  { id: "demo-route", text: "Which cities should Marlow Vane play on a Midwest leg in March?", context: { workspace: "Northside Live", role: "Promoter or venue", cities: ["Chicago"], project: { ...project, capacity: 1000 } } },
  { id: "demo-sponsors", text: "Find sponsors whose customers love Marlow Vane, for the Chicago show.", context: { workspace: "Northside Live", role: "Promoter or venue", cities: ["Chicago"], project } },
];

const out: Record<string, { title: string; text: string; steps: unknown; artifacts: unknown }> = {};
for (const a of asks) {
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: a.context.project, workspace: a.context.workspace });
  const r = await templateTurn(ctx, { conversationId: a.id, mode: "auto", messages: [{ role: "user", text: a.text }], context: a.context }, () => {});
  // fixture runs take a millisecond each; the demo gets plausible made-up timings, fake like the rest of it
  const steps = ctx.steps.map((s, i) => ({ ...s, ms: 300 + ((i * 137) % 500) }));
  const artifacts = r.artifacts.map((x, i) => ({ ...x, id: `${a.id}-a${i}` }));
  out[a.id] = { title: r.title, text: r.text, steps, artifacts };
}
writeFileSync("src/lib/demo-seed.json", JSON.stringify({ note: "FAKE demo data from fixtures/fake", asks: asks.map((a) => ({ id: a.id, text: a.text })), replies: out }, null, 1) + "\n");
console.log(Object.keys(out).join(", "));
