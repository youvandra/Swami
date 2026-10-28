// The no-LLM planner: reads the request with regexes and picks the tools the agent would call.

import { cityIn } from "../score/cities.ts";
import type { ToolName } from "../tools/index.ts";
import type { ChatContext, Mode } from "./types.ts";

export type Kind = Exclude<Mode, "auto">;

// Order matters: the most specific request wins.
const INTENTS: [Kind, RegExp][] = [
  ["email", /\b(email|e-mail|reach out|message|dm)\b/],
  ["proposal", /proposal|memo|deck|one-pager|pitch to/],
  ["sponsors", /sponsor|brand/],
  ["partners", /partner|co-?promo|flyer|bars? |shops?|local push/],
  ["venues", /venue|room|hall|hold/],
  ["routing", /route|routing|tour leg|\bleg\b|cities/],
  ["audience", /audience|demographic|who (are|is) (the|their) fans|\bage\b|gender/],
  ["map", /map|neighbou?rhood|where .*fans|heat|added crowd/],
];

export function intent(text: string, mode: Mode): Kind {
  if (mode !== "auto") return mode;
  const t = text.toLowerCase();
  return INTENTS.find(([, re]) => re.test(t))?.[0] ?? "opener";
}

const MONTH = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b(?: \d{1,2}\b)?/;
const REGION = /\b(midwest|northeast|south|west coast|west)\b/i;

export type Plan = {
  kind: Kind;
  headliner?: string;
  input: Record<string, unknown>;
  tools: ToolName[];
};

/** A capitalised name after "for", "with", "of" or "to", up to four words. */
export function headlinerIn(text: string): string | undefined {
  const m = text.match(/\b(?:for|of|whose customers love|who love|fans of)\s+((?:the |The )?[A-Z0-9][\w'&.-]*(?:\s+(?:&|the|of|[A-Z0-9][\w'&.-]*)){0,4})/);
  const name = m?.[1]?.replace(/[.,!?]+$/, "").replace(/\s+(?:in|on|at|and|for)$/, "").trim();
  if (!name) return undefined;
  // a city or month picked up by the pattern is no artist
  if (cityIn(` ${name} `)?.name.toLowerCase() === name.toLowerCase() || MONTH.test(name)) return undefined;
  return name.replace(/'s$/, "");
}

export function plan(text: string, mode: Mode, ctx?: ChatContext): Plan {
  const kind = intent(text, mode);
  const named = headlinerIn(text);
  const headliner = named ?? ctx?.project?.headliner ?? ctx?.artists?.[0];
  const city = cityIn(text)?.name;
  const date = text.match(MONTH)?.[0];
  const t = text.toLowerCase();
  const input: Record<string, unknown> = { headliner, city, date };
  if (/rising|up-and-coming|breaking/.test(t)) input.risingOnly = true;
  if (ctx?.roster && (kind === "opener" || /roster/.test(t))) input.roster = ctx.roster;
  // "Marlow Vane with Halcyon Drive", "Marlow Vane and Halcyon Drive": the second name is the opener
  const second = named ? text.slice(text.indexOf(named) + named.length).match(/^\s*(?:with|and|\+|&)\s+([A-Z][\w'.-]*(?:\s+(?:the|of|[A-Z][\w'.-]*)){0,3})/)?.[1] : undefined;
  if (second && ["map", "partners", "audience", "email", "proposal"].includes(kind)) input.opener = second.replace(/[.,!?]+$/, "");
  const tools: Record<Kind, ToolName[]> = {
    opener: ["rank_openers", "crowd_map"],
    map: ["crowd_map"],
    routing: ["route_tour"],
    venues: ["find_venues"],
    partners: ["find_partners", "crowd_map"],
    sponsors: ["match_sponsors"],
    audience: ["audience"],
    proposal: ["draft_proposal"],
    email: ["draft_email"],
  };
  if (kind === "routing") {
    const r = text.match(REGION)?.[1];
    input.region = r ? (/^west/i.test(r) ? "West" : r[0].toUpperCase() + r.slice(1).toLowerCase()) : undefined;
    input.anchorCity = city;
    input.date = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/)?.[0] ?? date;
  }
  if (kind === "proposal") input.template = /sponsor|brand/.test(t) ? "sponsor" : /memo|internal/.test(t) ? "memo" : "promoter";
  if (kind === "email") {
    input.kind = /sponsor|brand/.test(t) ? "sponsor" : /hold|venue/.test(t) ? "venue" : /co-?promot|partner/.test(t) ? "partner" : "opener";
    input.to = text.match(/(?:email|e-mail|message|write)\s+(?:to\s+)?([A-Z][\w'&]*(?:\s+[A-Z][\w'&]*){0,3})/)?.[1];
  }
  return { kind, headliner, input, tools: tools[kind] };
}
