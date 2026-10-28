// Message text written from tool facts, for template mode and as the fallback when the agent's prose fails its check.

import { listing } from "../score/normalize.ts";
import type { ToolOutcome } from "../tools/index.ts";

type F = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- facts are per-tool records

// Each tool says one lead sentence (the answer), a few short bullets (why, the runner-up, the caveat) and a next
// step. Only act names and the one key number are bold, the same shape the model is asked to write.
type Shape = { lead: string; bullets?: (string | false | undefined)[]; next?: string };

const b = (name: string) => `**${name}**`;
const ASSUMED = "Room sizes assume a 1,000-cap show; give me the capacity, or set it on a project, for sizes that fit.";

const LINES: Partial<Record<ToolOutcome["name"], (f: F) => Shape>> = {
  rank_openers: (f) => {
    const [top, second] = f.top ?? [];
    if (!top) return { lead: `I found no acts to rank for ${f.headliner}.` };
    return {
      lead: `${b(top.name)} leads the openers for ${f.headliner} in ${f.city}, with a score of **${top.score.toFixed(2)}**.`,
      bullets: [
        top.hoods?.length && `Its fans live in ${listing(top.hoods)}, where ${f.headliner} runs cold.`,
        second && `${b(second.name)} is next at ${second.score.toFixed(2)}.`,
        `Ranked ${f.roster ? `the ${f.candidates} acts on ${f.roster}` : `${f.candidates} acts`}.`,
        f.estimated && `${f.estimated === 1 ? "One pick is" : `${f.estimated} picks are`} estimated from their scene because their own data is thin.`,
        !f.heat && `There is no neighbourhood heat for ${f.city} yet, so reach gain is flat and fit decides.`,
      ],
      next: `Open the crowd map to see where the new crowd lives, or ask for a proposal with ${top.name}.`,
    };
  },
  crowd_map: (f) =>
    f.addedIn?.length
      ? { lead: `${b(f.opener)} adds the most new crowd in ${listing(f.addedIn)}.`, bullets: [`${f.headliner} already owns ${listing(f.headlinerStrongIn)}, so ads there mostly reach people who would come anyway.`], next: "Point the first ads at the new neighbourhoods." }
      : { lead: `${b(f.opener)}'s fans mostly live where ${f.headliner} already sells, so the added crowd is small.` },
  route_tour: (f) => ({
    lead: `${listing(f.strongest.map(b))} are the strongest markets for ${f.headliner} on this leg.`,
    bullets: [`${listing(f.weakest)} run thinner, so I suggested smaller rooms there.`, `The route covers about **${f.miles.toLocaleString("en-US")}** miles.`, f.capacityAssumed && ASSUMED],
    next: "Ask for an opener in any stop to fill the room.",
  }),
  find_venues: (f) => ({
    lead: `${b(f.best)} fits current demand best${typeof f.bestCapacity === "number" ? ` at **${f.bestCapacity.toLocaleString("en-US")}** capacity` : ""}.`,
    bullets: [f.fallback, f.next && `${b(f.next)} is the next strongest fit.`, f.capacityAssumed && `Rooms are picked for a ${f.size} act; give me the capacity, or set it on a project, to size them exactly.`],
    next: "Ask me to email the venue for a hold.",
  }),
  find_partners: (f) => ({
    lead: `${b(f.top[0])} is the strongest co-promo fit${f.hoods?.length ? ` in ${listing(f.hoods)}` : ""}.`,
    bullets: [`${f.count} places share the crowd.`, f.top[1] && `${b(f.top[1])} is next.`],
    next: "Give each partner its own promo link so you can see what sold.",
  }),
  match_sponsors: (f) => ({
    lead: `${b(f.top)} is the strongest sponsor match for ${f.headliner}.`,
    bullets: [f.topLift >= 1.3 ? `${f.headliner} fans are **${f.topLift}×** likelier than average to pick it.` : `${f.headliner} fans pick it more than its overall popularity predicts.`],
    next: "Each brand comes with a one-line pitch you can send as is.",
  }),
  audience: (f) =>
    f.demographics
      ? { lead: `${b(f.opener)} brings ${f.under30Pct.opener > f.under30Pct.headliner ? "a younger" : "an older"} crowd: **${f.under30Pct.opener}%** under 30, against ${f.under30Pct.headliner}% for ${f.headliner}.` }
      : { lead: "Demographics are thin for one of the acts, so the age split leans on the general concert crowd." },
  draft_proposal: (f) => ({
    lead: `Here is a draft ${String(f.template).toLowerCase()} for ${f.headliner}, built on ${b(f.top)}${f.alternates?.length ? ` with ${listing(f.alternates)} as alternates` : ""}.`,
    next: "Edit any line, switch the template, or export it to PDF or Word.",
  }),
  draft_email: () => ({ lead: "Here is a draft.", next: "Edit the subject or body, then copy it or open it in your mail app." }),
};

/** A lead line, up to four bullets and one next step, from the tools that ran; failures become bullets. */
export function proseFor(outcomes: ToolOutcome[]): string {
  const shapes: Shape[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const o of outcomes) {
    if (seen.has(o.name)) continue;
    seen.add(o.name);
    // the map line repeats what the ranking or the partner list already says; keep it only when it stands alone
    if (o.ok && o.name === "crowd_map" && outcomes.some((x) => x.ok && x.name !== "crowd_map" && x.name !== "search_artist")) continue;
    if (o.ok) {
      const shape = LINES[o.name]?.(o.facts);
      if (shape) shapes.push(shape);
    } else {
      const line = o.error.endsWith(".") ? o.error : `${o.error}.`;
      if (!failures.includes(line)) failures.push(line);
    }
  }
  if (!shapes.length) return failures.join(" ") || "Done.";
  const [first, ...more] = shapes;
  const bullets = [...failures, ...(first.bullets ?? []), ...more.map((m) => m.lead)].filter((x): x is string => !!x).slice(0, 4);
  return [first.lead, bullets.map((x) => `- ${x}`).join("\n"), first.next].filter(Boolean).join("\n\n");
}

/** Every number in the text must appear in what the tools returned or the user wrote; otherwise the text is rejected. */
export function numbersBacked(text: string, sources: unknown[]): boolean {
  const pool = JSON.stringify(sources);
  const nums = text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  return nums.every((n) => {
    const plain = n.replace(/,/g, "");
    if (pool.includes(plain) || pool.includes(n)) return true;
    const v = Number(plain);
    if (!Number.isFinite(v)) return false;
    // a trailing zero the JSON drops: 0.90 from 0.9
    if (pool.includes(String(v))) return true;
    // percentages of a 0..1 value: 52% from 0.52
    return v <= 100 && pool.includes(String(v / 100));
  });
}

/** Sidebar titles: what the answer is, for whom, and where, short enough to tell chats apart. */
export function titleFor(kind: string, show: { headliner?: string; city?: string; date?: string }): string {
  const h = show.headliner;
  if (!h) return "New chat";
  const where = [show.city, show.date].filter(Boolean).join(", ");
  const label: Record<string, string> = { opener: "Openers", map: "Crowd map", routing: "Tour leg", venues: "Venues", partners: "Co-promo", sponsors: "Sponsors", audience: "Audience", proposal: "Proposal", email: "Email" };
  // the sidebar cuts long titles, so the parts that tell chats apart come first
  const at = kind === "routing" || kind === "sponsors" || !where ? "" : `, ${where}`;
  return `${label[kind] ?? "Chat"}${at} · ${h}`;
}
