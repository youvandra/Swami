// Asks before it guesses. Runs ahead of the agent and template mode, so a request that leaves out who it is for
// gets a question instead of an answer about someone else: no artist named and no show in the chat asks which
// artist; a proposal, email, map, audience or partner list with no opener chosen shows the ranking first and asks
// which act to use.

import { examplesFor } from "../examples.ts";
import { searchArtist } from "../tools/tools.ts";
import { runTool } from "../tools/index.ts";
import type { ToolContext } from "../tools/context.ts";
import type { Emit } from "./events.ts";
import { titleFor } from "./prose.ts";
import { headlinerIn, plan, type Kind } from "./router.ts";
import type { TurnResult } from "./turn.ts";
import type { ChatRequest, Choice, Choices, OpenerRow } from "./types.ts";

const NEEDS_OPENER: Kind[] = ["proposal", "email", "map", "audience", "partners"];

const WHAT: Record<string, string> = { proposal: "the proposal", email: "the email", map: "the crowd map", audience: "the audience profile", partners: "the co-promo list" };

const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** The question an opener card sends back: the same request with that act named after the headliner. */
export function askWith(kind: Kind, input: Record<string, unknown>, opener: string): string {
  const h = String(input.headliner);
  const where = `in ${input.city}${input.date ? `, ${input.date}` : ""}`;
  switch (kind) {
    case "proposal": {
      const t = input.template === "sponsor" ? "sponsor proposal" : input.template === "memo" ? "booking memo" : "proposal";
      return `Write a ${t} for ${h} with ${opener} ${where}, addressed to their management.`;
    }
    case "email": {
      const k = input.kind === "venue" ? "venue hold email" : input.kind === "sponsor" ? "sponsor email" : input.kind === "partner" ? "co-promo email" : "opener email";
      return `Draft the ${k} for ${h} with ${opener} ${where}.`;
    }
    case "map":
      return `Map the added crowd for ${h} with ${opener} ${where}.`;
    case "audience":
      return `Who is the audience for ${h} with ${opener} ${where}? Age and gender.`;
    default:
      return `Find co-promo partners for ${h} with ${opener} ${where}.`;
  }
}

function say(emit: Emit, text: string, kind: Kind, show: { headliner?: string; city?: string; date?: string }, extra: Partial<TurnResult> = {}): TurnResult {
  emit({ type: "text", delta: text });
  if (extra.choices) emit({ type: "choices", choices: extra.choices });
  return { text, artifacts: [], outcomes: [], title: titleFor(kind, show), ...extra };
}

export async function gate(ctx: ToolContext, req: ChatRequest, text: string, emit: Emit): Promise<TurnResult | null> {
  const c = req.context;
  const p = plan(text, req.mode, c);
  const named = headlinerIn(text);
  const known = named ?? c?.last?.headliner ?? c?.project?.headliner;

  // 1. who is it for? The workspace's own artists become cards; without any, an example shows the shape.
  if (!known) {
    const pool = (c?.artists ?? []).slice(0, 3);
    const found = await Promise.all(pool.map((name) => searchArtist(ctx, { name, take: 1 }).catch(() => null)));
    const base = text.trim().replace(/[.?!]+$/, "");
    // only a name the taste graph knows as written: a near match would be someone else's artist
    const options: Choice[] = found.flatMap((s, i) => {
      const a = s?.candidates.find((x) => same(x.name, pool[i]));
      return a ? [{ id: a.id, name: a.name, image: a.image, detail: a.genre ?? "Your artist", reply: `${base} for ${a.name}.` }] : [];
    });
    if (options.length === 0) {
      return say(emit, `Which artist is this for? Name the headliner, for example “Find an opener for ${examplesFor(ctx.live ?? false).mid} in Chicago, Mar 14.”`, p.kind, {});
    }
    const choices: Choices = { prompt: "Which artist is this for?", key: options[0].name.toLowerCase(), options };
    return say(emit, "Which artist is this for? Pick one of yours, or name another act.", p.kind, {}, { choices });
  }

  // 2. which opener? Only when the request needs one, none was named, and the chat has not settled one for this show.
  if (!NEEDS_OPENER.includes(p.kind) || p.input.opener) return null;
  if (same(c?.last?.headliner, String(p.input.headliner)) && c?.last?.opener) return null;

  const { roster, ...input } = p.input;
  const rank = await runTool(ctx, "rank_openers", input, roster ? { roster } : {});
  if (!rank.ok || rank.artifact?.type !== "opener_ranking") return null; // the turn itself reports what failed
  const art = rank.artifact;
  emit({ type: "artifact", artifact: art });
  // a card remembers the act's Qloo id, so the follow-up resolves it without another search; acts without one stay off
  const idOf = (name: string) => [...ctx.seen.values()].find((e) => same(e.name, name))?.id;
  const scored = art.rows.filter((r) => r.score > 0);
  const picks = (scored.length ? scored : art.rows).flatMap((r: OpenerRow) => {
    const id = idOf(r.name);
    return id ? [{ r, id }] : [];
  });
  if (picks.length === 0) return null;
  const show = { ...input, headliner: art.show.headliner, city: art.show.city, date: input.date ? art.show.date : undefined };
  const options: Choice[] = picks.slice(0, 3).map(({ r, id }) => ({
    id,
    name: r.name,
    detail: `Score ${r.score.toFixed(2)} · fit ${r.fit.toFixed(2)}`,
    reply: askWith(p.kind, show, r.name),
  }));
  const choices: Choices = { prompt: `Which act should ${WHAT[p.kind]} feature?`, key: "opener", options };
  const lead = `Before ${WHAT[p.kind]}: no opener is set for **${art.show.headliner}** in ${art.show.city} yet, so here is the ranking. Which act should it feature?`;
  return say(emit, lead, p.kind, art.show, { artifacts: [art], outcomes: [rank], choices });
}
