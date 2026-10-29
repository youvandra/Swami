// Answers to the "which one do you mean?" cards: a click, "none of these", "the second one", or a hint that
// sends the search round again. Both the agent and template mode go through here before they plan anything.

import { searchArtist } from "../tools/tools.ts";
import type { Candidate } from "../tools/tools.ts";
import { REJECTED, type ToolContext } from "../tools/context.ts";
import type { Emit } from "./events.ts";
import { headlinerIn } from "./router.ts";
import type { TurnResult } from "./turn.ts";
import { NONE_ID, type ChatRequest, type Choice, type Choices } from "./types.ts";

export const noneCard = (): Choice => ({ id: NONE_ID, name: "None of These", detail: "Search again with a hint", reply: "None of these" });

// entities key for the question waiting for a hint (REJECTED holds the acts turned down for a name)
const RETRY = "retry:";

const NEGATIVE = /^\W*(?:none|no one|nobody|neither|nope|wrong|not (?:these|those|them|any|this|that|it)|bukan|ga ada|gak ada|nggak ada|enggak ada|tidak ada|ndak ada)\b/i;
const ORDINALS = [
  /\b(?:first|1st|pertama|satu)\b/i,
  /\b(?:second|2nd|two|kedua|dua)\b/i,
  /\b(?:third|3rd|three|ketiga|tiga)\b/i,
  /\b(?:fourth|4th|four|keempat|empat)\b/i,
];
const FILLER = new Set(["the", "one", "that", "this", "band", "artist", "singer", "act", "from", "with", "who", "yang", "dari", "mean", "meant"]);
const words = (t: string) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !FILLER.has(w));

const ASKING = /\b(?:find|which|who|route|venues?|openers?|sponsors?|proposal|email|audience|partners?|map|draft|write)\b/i;

export type Answer = { kind: "none" } | { kind: "pick"; option: Choice };

/** What a free-text reply to the cards means, or null when it is a new question. */
export function answerChoice(text: string, options: Choice[]): Answer | null {
  const cards = options.filter((o) => o.id !== NONE_ID);
  const t = text.trim().toLowerCase();
  if (NEGATIVE.test(t)) return { kind: "none" };
  const named = cards.filter((o) => t.includes(o.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);
  if (named.length) return { kind: "pick", option: named[0] };
  // "the second one", "number 2", "2": only in a short reply, so "1,100 people" in a new question stays a question
  if (t.length <= 40) {
    const n = t.match(/^(?:#|no\.?\s*|number\s*)?([1-4])\b/)?.[1] ?? t.match(/\b(?:#|number\s*)([1-4])\b/)?.[1];
    const i = n ? Number(n) - 1 : ORDINALS.findIndex((re) => re.test(t));
    if (i >= 0 && cards[i]) return { kind: "pick", option: cards[i] };
  }
  // "the folk one": words that only one card's genre or detail has
  const said = new Set(words(t));
  const hits = cards.filter((o) => words(o.detail).some((w) => said.has(w)));
  if (hits.length === 1 && t.length <= 80) return { kind: "pick", option: hits[0] };
  return null;
}

function reject(ctx: ToolContext, key: string, ids: string[]) {
  const all = new Set([...(ctx.entities[REJECTED + key]?.split(",") ?? []), ...ids].filter(Boolean));
  ctx.entities[REJECTED + key] = [...all].join(",");
}

const say = (emit: Emit, text: string, choices?: Choices): { result: TurnResult } => {
  emit({ type: "text", delta: text });
  if (choices) emit({ type: "choices", choices });
  return { result: { text, artifacts: [], title: "", choices, outcomes: [] } };
};

/** The cards for one name, with "None of these" last. */
export function cardsFor(name: string, key: string, ask: string, candidates: Candidate[]): Choices {
  const options = candidates.slice(0, 4).map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image,
    detail: [c.genre, c.detail].filter(Boolean).join(" · ") || "Artist",
    reply: ask.includes(name) ? ask.replace(name, c.name) : `${ask} (${c.name})`,
  }));
  return { prompt: `Which ${name} do you mean?`, key, name, ask, options: [...options, noneCard()] };
}

export type Answered = { result: TurnResult } | { ask: string } | null;

/**
 * Settles a reply to the cards before the turn plans anything: a pick becomes the original question with that act
 * resolved, "none" asks for a hint, and the hint searches again without the acts already turned down.
 */
export async function answerCards(ctx: ToolContext, req: ChatRequest, text: string, emit: Emit): Promise<Answered> {
  const pending = req.context?.choices;
  if (pending) {
    const a = answerChoice(text, pending.options);
    const name = pending.name ?? pending.key;
    if (a?.kind === "pick") {
      ctx.entities[pending.key] = a.option.id;
      ctx.entities[a.option.name.toLowerCase()] = a.option.id;
      return { ask: a.option.reply };
    }
    if (a?.kind === "none") {
      reject(ctx, pending.key, pending.options.map((o) => o.id).filter((id) => id !== NONE_ID));
      if (pending.ask) ctx.entities[RETRY + pending.key] = pending.ask;
      return say(emit, `Then I have the wrong ${name}. Send another spelling, or the act's label, home city or genre, or a Qloo link, and I will search again.`);
    }
    return null;
  }

  const waiting = Object.keys(ctx.entities).find((k) => k.startsWith(RETRY));
  if (!waiting) return null;
  const key = waiting.slice(RETRY.length);
  const ask = ctx.entities[waiting];
  delete ctx.entities[waiting];
  // a whole new question about someone else drops the search; "the one with Ty Segall vibes" is still a hint
  const named = headlinerIn(text);
  if (named && !named.toLowerCase().includes(key) && ASKING.test(text)) return null;
  const id = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (id) {
    ctx.entities[key] = id;
    return { ask };
  }
  const hint = text.replace(/https?:\/\/\S+/g, "").trim();
  const name = ask.match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))?.[0] ?? key;
  const [withHint, plain] = await Promise.all([searchArtist(ctx, { name: `${name} ${hint}`, take: 10 }), searchArtist(ctx, { name, take: 10 })]);
  const seen = new Set<string>();
  const pool = [...withHint.candidates, ...plain.candidates].filter((c) => !seen.has(c.id) && seen.add(c.id));
  const said = new Set(words(hint));
  // how many of the hint's words the act's name, genre or blurb has
  const score = (c: Candidate) => new Set(words([c.name, c.genre, c.detail].filter(Boolean).join(" ")).filter((w) => said.has(w))).size;
  const ranked = pool.map((c) => ({ c, n: score(c) })).sort((a, b) => b.n - a.n || Number(withHint.candidates.includes(b.c)) - Number(withHint.candidates.includes(a.c)) || (b.c.popularity ?? 0) - (a.c.popularity ?? 0));
  if (ranked.length === 0) {
    ctx.entities[waiting] = ask;
    return say(emit, `Still nothing for ${name} with that. Try the spelling on the act's own pages, or paste a Qloo link.`);
  }
  // one act left, or the only one every word of the hint fits: settle it, and re-ask by its full name
  const whole = ranked.filter((r) => said.size > 0 && r.n === said.size);
  const pick = ranked.length === 1 ? ranked[0].c : whole.length === 1 ? whole[0].c : undefined;
  if (pick) {
    ctx.entities[key] = pick.id;
    ctx.entities[pick.name.toLowerCase()] = pick.id;
    return { ask: ask.includes(name) ? ask.replace(name, pick.name) : `${ask} (${pick.name})` };
  }
  return say(emit, `Here is what else the taste graph has for ${name}. Which one is it?`, cardsFor(name, key, ask, ranked.map((r) => r.c)));
}
