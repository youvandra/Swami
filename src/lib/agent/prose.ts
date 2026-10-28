// Message text written from tool facts, for template mode and as the fallback when the agent's prose fails its check.

import { listing } from "../score/normalize.ts";
import type { ToolOutcome } from "../tools/index.ts";

type F = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- facts are per-tool records

const LINES: Partial<Record<ToolOutcome["name"], (f: F) => string>> = {
  rank_openers: (f) => {
    const [top, second] = f.top ?? [];
    if (!top) return `I found no acts to rank for ${f.headliner}.`;
    const est = f.estimated ? ` ${f.estimated === 1 ? "One pick is" : `${f.estimated} picks are`} estimated from their scene because their own data is thin.` : "";
    const where = top.hoods?.length ? `, and its fans live in ${listing(top.hoods)}, where ${f.headliner} runs cold` : "";
    const heat = f.heat ? "" : ` There is no neighbourhood heat for ${f.city} yet, so reach gain is flat and fit decides.`;
    return `I ranked ${f.candidates} acts for ${f.headliner} in ${f.city}. ${top.name} leads with a score of ${top.score.toFixed(2)}${where}.${second ? ` ${second.name} is next at ${second.score.toFixed(2)}.` : ""}${est}${heat}`;
  },
  crowd_map: (f) => (f.addedIn?.length ? `${f.opener} adds the most new crowd in ${listing(f.addedIn)}. ${f.headliner} already owns ${listing(f.headlinerStrongIn)}, so ads there mostly reach people who would come anyway.` : `${f.opener}'s fans mostly live where ${f.headliner} already sells, so the added crowd is small.`),
  route_tour: (f) => `${listing(f.strongest)} are the strongest markets for ${f.headliner} on this leg. ${listing(f.weakest)} run thinner, so I suggested smaller rooms there. The route covers about ${f.miles.toLocaleString("en-US")} miles.`,
  find_venues: (f) => `${f.best} fits current demand best${typeof f.bestCapacity === "number" ? ` at ${f.bestCapacity.toLocaleString("en-US")} capacity` : ""}.${f.next ? ` ${f.next} is the next strongest fit.` : ""}`,
  find_partners: (f) => `${f.count} places in ${listing(f.hoods) || "the city"} share the crowd. ${listing(f.top)} ${f.top.length > 1 ? "are" : "is"} the strongest fit; give each its own promo link so you can see what sold.`,
  match_sponsors: (f) => `${f.top} is the strongest match: ${f.headliner} fans are ${f.topLift}× likelier than average to pick it. Each brand comes with a one-line pitch you can send as is.`,
  audience: (f) => (f.demographics ? `${f.opener} brings ${f.under30Pct.opener > f.under30Pct.headliner ? "a younger" : "an older"} crowd: ${f.under30Pct.opener}% under 30, against ${f.under30Pct.headliner}% for ${f.headliner}.` : `Demographics are thin for one of the acts, so the age split leans on the general concert crowd.`),
  draft_proposal: (f) => `Here is a draft ${String(f.template).toLowerCase()} for ${f.headliner}, built on ${f.top}${f.alternates?.length ? ` with ${listing(f.alternates)} as alternates` : ""}. Edit any line, switch the template, or export it to PDF or Word.`,
  draft_email: () => "Here is a draft. Edit the subject or body, then copy it or open it in your mail app.",
};

/** One or two sentences per tool that ran, plus a plain line per failure. */
export function proseFor(outcomes: ToolOutcome[]): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const o of outcomes) {
    if (seen.has(o.name)) continue;
    seen.add(o.name);
    // the map line repeats what the ranking or the partner list already says; keep it only when it stands alone
    if (o.ok && o.name === "crowd_map" && outcomes.some((x) => x.ok && x.name !== "crowd_map" && x.name !== "search_artist")) continue;
    if (o.ok) {
      const line = LINES[o.name]?.(o.facts);
      if (line) parts.push(line);
    } else {
      const line = o.error.endsWith(".") ? o.error : `${o.error}.`;
      if (!parts.includes(line)) parts.push(line);
    }
  }
  return parts.join(" ") || "Done.";
}

/** Every number in the text must appear in what the tools returned or the user wrote; otherwise the text is rejected. */
export function numbersBacked(text: string, sources: unknown[]): boolean {
  const pool = JSON.stringify(sources);
  const nums = text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  return nums.every((n) => {
    const plain = n.replace(/,/g, "");
    if (pool.includes(plain) || pool.includes(n)) return true;
    // percentages of a 0..1 value: 52% from 0.52
    const v = Number(plain);
    return Number.isFinite(v) && v <= 100 && pool.includes(String(v / 100));
  });
}

export function titleFor(kind: string, show: { headliner?: string; city?: string; date?: string }): string {
  const h = show.headliner ?? "New chat";
  const c = show.city ?? "";
  const map: Record<string, string> = {
    opener: `${c}${show.date ? `, ${show.date}` : ""} · openers`,
    map: `${c} · added crowd`,
    routing: `Tour leg · ${h}`,
    venues: `${c} · venues`,
    partners: `${c} · co-promo`,
    sponsors: `Sponsors · ${h}`,
    audience: `Audience · ${h}`,
    proposal: `Proposal · ${h}`,
    email: `Email · ${h}`,
  };
  return (map[kind] ?? h).replace(/^ · /, `${h} · `);
}
