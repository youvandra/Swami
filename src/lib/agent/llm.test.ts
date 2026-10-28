import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { FAKE_GRAPH } from "../../../fixtures/fake/graph.ts";
import { FixtureQloo } from "../qloo/fixture.ts";
import { makeContext } from "../tools/context.ts";
import { fromChatResponse, toChatRequest } from "./chat-completions.ts";
import type { AgentEvent } from "./events.ts";
import { agentTurn, type MessagesClient } from "./llm.ts";
import type { ChatRequest } from "./types.ts";

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

// A scripted model: each call returns the next reply, and the requests are kept for inspection.
function scripted(replies: Block[][]) {
  const seen: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    beta: {
      messages: {
        async create(params) {
          seen.push(structuredClone(params));
          const content = replies[seen.length - 1] ?? [{ type: "text", text: "Done." }];
          return { id: `m${seen.length}`, type: "message", role: "assistant", model: "test", content, stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn", usage: { input_tokens: 10, output_tokens: 5 } } as unknown as Anthropic.Beta.BetaMessage;
        },
      },
    },
  };
  return { client, seen };
}

const req = (text: string): ChatRequest => ({ conversationId: "c", mode: "auto", messages: [{ role: "user", text }], context: { workspace: "W", role: "Promoter", cities: ["Chicago"] } });
const turn = async (replies: Block[][], text = "Find an opener for Marlow Vane in Chicago") => {
  const { client, seen } = scripted(replies);
  const events: AgentEvent[] = [];
  const ctx = makeContext(new FixtureQloo(FAKE_GRAPH), { defaults: { city: "Chicago" } });
  const usage = { input: 0, output: 0 };
  const out = await agentTurn(client, "test", ctx, req(text), (e) => events.push(e), usage);
  return { out, seen, events, usage };
};

const call = (id: string, name: string, input: unknown): Block => ({ type: "tool_use", id, name, input });

test("the loop runs the model's tools, feeds results back and keeps backed prose", async () => {
  const { out, seen, usage } = await turn([
    [call("t1", "search_artist", { name: "Marlow Vane" })],
    [call("t2", "rank_openers", { headliner: "Marlow Vane", city: "Chicago" }), call("t3", "crowd_map", { headliner: "Marlow Vane", city: "Chicago" })],
    [{ type: "text", text: "Halcyon Drive leads at 0.90 and brings Logan Square and Pilsen." }],
  ]);
  assert.deepEqual(out.artifacts.map((a) => a.type), ["opener_ranking", "crowd_map"]);
  assert.equal(out.text, "Halcyon Drive leads at 0.90 and brings Logan Square and Pilsen.");
  assert.equal(seen.length, 3);
  const results = seen[2].messages[seen[2].messages.length - 1].content as { type: string; tool_use_id: string }[];
  assert.deepEqual(results.map((r) => r.tool_use_id), ["t2", "t3"]);
  assert.match(String(seen[0].messages[0].content), /<user_data>/);
  assert.deepEqual(usage, { input: 30, output: 15 });
});

test("a number the tools never produced sends the turn to template prose", async () => {
  const { out } = await turn([[call("t1", "rank_openers", { headliner: "Marlow Vane" })], [{ type: "text", text: "Halcyon Drive will sell 4,000 tickets." }]]);
  assert.match(out.text, /^I ranked \d+ acts/);
});

test("bad tool input comes back as an error result the model can fix", async () => {
  const { seen } = await turn([[call("t1", "rank_openers", { city: "Chicago" })], [{ type: "text", text: "Which headliner?" }]]);
  const r = (seen[1].messages[seen[1].messages.length - 1].content as { is_error: boolean; content: string }[])[0];
  assert.equal(r.is_error, true);
  assert.match(r.content, /headliner/);
});

test("an ambiguous search stops the loop with choices", async () => {
  const { out, seen } = await turn([[call("t1", "search_artist", { name: "Marlow" })], [call("t2", "rank_openers", { headliner: "Marlow" })]], "Find an opener for Marlow");
  assert.equal(seen.length, 1);
  assert.deepEqual(out.choices?.options.map((o) => o.name), ["Marlow Vane", "Marlow & the Tide", "None of these"]);
  assert.equal(out.artifacts.length, 0);
});

test("compat translation keeps system text, tools and tool results", () => {
  const body = toChatRequest({
    model: "m",
    max_tokens: 100,
    system: [{ type: "text", text: "S" }],
    tools: [{ name: "x", description: "d", input_schema: { type: "object" } }],
    messages: [
      { role: "user", content: "hi" },
      { role: "assistant", content: [{ type: "tool_use", id: "a", name: "x", input: { q: 1 } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "ok" }] },
    ],
  });
  assert.deepEqual(body.messages.map((m) => m.role), ["system", "user", "assistant", "tool"]);
  assert.equal(body.tools?.[0].function.name, "x");
  const back = fromChatResponse({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c", type: "function", function: { name: "x", arguments: "{bad" } }] } }] }, "m");
  assert.equal(back.stop_reason, "tool_use");
  assert.deepEqual((back.content[0] as { input: unknown }).input, {});
});
