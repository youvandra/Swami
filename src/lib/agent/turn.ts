// One chat turn in template mode: the router picks tools, the tools run on Qloo or the fixture, prose.ts writes
// the text. The agent loop reuses the same pieces, so this is also its fallback.

import { searchArtist } from "../tools/tools.ts";
import { runTool, type ToolOutcome } from "../tools/index.ts";
import type { ToolContext } from "../tools/context.ts";
import type { Emit } from "./events.ts";
import { proseFor, titleFor } from "./prose.ts";
import { plan } from "./router.ts";
import type { Artifact, ChatRequest, Choices } from "./types.ts";

export type TurnResult = { text: string; artifacts: Artifact[]; title: string; choices?: Choices; outcomes: ToolOutcome[] };

export const lastUserText = (req: ChatRequest) => [...req.messages].reverse().find((m) => m.role === "user")?.text ?? "";

/** Ask which artist was meant when the name alone picks none, or several. */
export async function disambiguate(ctx: ToolContext, name: string, text: string): Promise<{ choices?: Choices; text?: string } | null> {
  const key = name.trim().toLowerCase();
  if (ctx.entities[key]) return null;
  const s = await searchArtist(ctx, { name });
  if (s.candidates.length === 0) return { text: `I could not find “${name}” in the taste graph. Check the spelling, or name the act another way.` };
  if (!s.ambiguous) {
    ctx.entities[key] = s.candidates[0].id;
    return null;
  }
  const options = s.candidates.slice(0, 4).map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image,
    detail: [c.genre, c.detail].filter(Boolean).join(" · ") || "Artist",
    reply: text.includes(name) ? text.replace(name, c.name) : `${text} (${c.name})`,
  }));
  return { choices: { prompt: `Which ${name} do you mean?`, key, options }, text: `There is more than one ${name} in the taste graph. Which one do you mean?` };
}

export async function templateTurn(ctx: ToolContext, req: ChatRequest, emit: Emit): Promise<TurnResult> {
  const text = lastUserText(req);
  const p = plan(text, req.mode, req.context);
  const show = { headliner: p.headliner, city: (p.input.city as string) ?? ctx.defaults.city, date: (p.input.date as string) ?? ctx.defaults.date };
  if (!p.headliner) {
    const t = "Which artist is this for? Name the headliner, for example “Find an opener for Marlow Vane in Chicago, Mar 14.”";
    emit({ type: "text", delta: t });
    return { text: t, artifacts: [], title: "New chat", outcomes: [] };
  }
  const ask = await disambiguate(ctx, p.headliner, text);
  if (ask) {
    emit({ type: "text", delta: ask.text! });
    if (ask.choices) emit({ type: "choices", choices: ask.choices });
    return { text: ask.text!, artifacts: [], title: titleFor(p.kind, show), choices: ask.choices, outcomes: [] };
  }

  const outcomes: ToolOutcome[] = [];
  const artifacts: Artifact[] = [];
  for (const name of p.tools) {
    const { roster, ...input } = p.input;
    const o = await runTool(ctx, name, input, name === "rank_openers" && roster ? { roster } : {});
    outcomes.push(o);
    if (o.ok && o.artifact) {
      artifacts.push(o.artifact);
      emit({ type: "artifact", artifact: o.artifact });
    }
  }
  const prose = proseFor(outcomes);
  emit({ type: "text", delta: prose });
  const resolved = artifacts[0]?.show ?? show;
  return { text: prose, artifacts, title: titleFor(p.kind, { ...show, headliner: resolved.headliner, city: resolved.city }), outcomes };
}
