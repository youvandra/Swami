// The agent loop on the Claude API: the model plans tool calls and writes the message; tools build every
// artifact. Any failure here drops the turn to template mode in run.ts.

import Anthropic from "@anthropic-ai/sdk";
import { runTool, toolDefinitions, type ToolOutcome } from "../tools/index.ts";
import type { ToolContext } from "../tools/context.ts";
import type { Emit } from "./events.ts";
import { numbersBacked, proseFor, titleFor } from "./prose.ts";
import { intent } from "./router.ts";
import { SYSTEM, userBlock } from "./system.ts";
import { disambiguate, lastUserText, type TurnResult } from "./turn.ts";
import type { Artifact, ChatRequest, Choices } from "./types.ts";

const MAX_ROUNDS = 6;
const WALL_MS = 60_000;
const HISTORY = 12;

export class AgentUnavailable extends Error {}

/** The slice of the SDK client the loop uses; the compat adapter implements it for other endpoints. */
export type MessagesClient = {
  beta: { messages: { create(params: Anthropic.Beta.MessageCreateParamsNonStreaming, opts?: { signal?: AbortSignal }): Promise<Anthropic.Beta.BetaMessage> } };
};

export type Usage = { input: number; output: number };

export async function agentTurn(client: MessagesClient, model: string, ctx: ToolContext, req: ChatRequest, emit: Emit, usage: Usage, signal?: AbortSignal): Promise<TurnResult> {
  const started = Date.now();
  const history = req.messages.slice(-HISTORY);
  const last = lastUserText(req);
  const context = { workspace: req.context?.workspace, role: req.context?.role, cities: req.context?.cities, project: req.context?.project, last: req.context?.last, roster: req.context?.roster ? { name: req.context.roster.name, acts: req.context.roster.acts.length } : undefined, resolved: Object.keys(ctx.entities) };
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m, i) => ({ role: m.role, content: i === history.length - 1 && m.role === "user" ? userBlock(m.text, context) : m.text }));
  while (messages.length && messages[0].role !== "user") messages.shift();

  const tools = toolDefinitions().map((t, i, all) => (i === all.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t));
  const outcomes: ToolOutcome[] = [];
  const artifacts: Artifact[] = [];
  let text = "";
  let choices: Choices | undefined;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (Date.now() - started > WALL_MS) break;
    const res = await client.beta.messages.create(
      {
        model,
        max_tokens: 4096,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      },
      { signal },
    );
    usage.input += res.usage?.input_tokens ?? 0;
    usage.output += res.usage?.output_tokens ?? 0;
    if (res.stop_reason === "refusal") throw new AgentUnavailable("refused");
    messages.push({ role: "assistant", content: res.content });
    text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || calls.length === 0) break;

    // the roster stays server-side: the model asks for a ranking and the attached roster rides along
    const results = await Promise.all(
      calls.map((c) => runTool(ctx, c.name, c.input, c.name === "rank_openers" && req.context?.roster ? { roster: req.context.roster } : {})),
    );
    for (const o of results) {
      outcomes.push(o);
      if (o.ok && o.artifact) {
        artifacts.push(o.artifact);
        emit({ type: "artifact", artifact: o.artifact });
      }
    }
    const ambiguous = results.find((o) => o.ok && o.name === "search_artist" && o.search?.ambiguous);
    if (ambiguous && ambiguous.ok) {
      const name = String((calls[results.indexOf(ambiguous)].input as { name: string }).name);
      const ask = await disambiguate(ctx, name, last);
      if (ask?.choices) {
        choices = ask.choices;
        text = ask.text!;
        break;
      }
    }
    messages.push({
      role: "user",
      content: calls.map((c, i) => {
        const o = results[i];
        return { type: "tool_result" as const, tool_use_id: c.id, is_error: !o.ok, content: o.ok ? JSON.stringify(o.facts).slice(0, 6000) : o.error };
      }),
    });
  }

  // The model writes the words; the numbers in them must come from the tools.
  const sources = [outcomes.map((o) => (o.ok ? o.facts : o.error)), artifacts, req.messages.map((m) => m.text)];
  if (!text || (!choices && !numbersBacked(text, sources))) text = outcomes.length ? proseFor(outcomes) : text || "Done.";
  emit({ type: "text", delta: text });
  if (choices) emit({ type: "choices", choices });
  const show = artifacts[0]?.show;
  return { text, artifacts, choices, outcomes, title: titleFor(intent(last, req.mode), { headliner: show?.headliner, city: show?.city, date: show?.date }) };
}
