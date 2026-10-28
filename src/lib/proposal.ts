// Proposal templates. The agent drafts with one; the editor can redraft with another from the same data.

import type { OpenerRow, ProposalFacts, ProposalSection, ProposalTemplate, Show } from "./agent/types";

type PickRow = Pick<OpenerRow, "name" | "score" | "why">;

export const TEMPLATES: { id: ProposalTemplate; label: string; kicker: string; description: string }[] = [
  { id: "promoter", label: "Opener proposal", kicker: "Opener proposal", description: "To the headliner's management: who opens and why it sells." },
  { id: "sponsor", label: "Sponsor pitch", kicker: "Sponsorship proposal", description: "To a brand: the audience, the activation, what they get." },
  { id: "memo", label: "Booking memo", kicker: "Booking memo", description: "Internal: the recommendation, the evidence, the ask." },
];

export const templateOf = (t?: ProposalTemplate) => TEMPLATES.find((x) => x.id === (t ?? "promoter"))!;

const sid = () => Math.random().toString(36).slice(2, 9);

const list = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function draftProposal(template: ProposalTemplate, show: Show, picks: PickRow[], facts: ProposalFacts = { hoods: [], partners: [] }) {
  const [top, alt1 = top, alt2 = alt1] = picks;
  const cap = show.capacity.toLocaleString("en-US");
  const where = show.venue ? `${show.venue}, ${show.city}` : show.city;
  const sponsor = facts.sponsor ?? "your brand";
  const hoods = facts.hoods.length ? list(facts.hoods) : "the neighbourhoods where the new crowd lives";
  const partners = facts.partners.length ? `co-promotion with ${list(facts.partners)}` : "co-promotion with local bars and record shops";
  let to: string;
  let headline: string;
  let sections: Omit<ProposalSection, "id">[];

  if (template === "sponsor") {
    to = `${sponsor}, partnerships`;
    headline = `${sponsor} × ${show.headliner}`;
    sections = [
      { heading: "The show", body: `${show.headliner} with ${top.name} at ${where} on ${show.date}. A ${cap}-capacity room, promoted for two weeks across ${hoods}.` },
      { heading: "Why this audience", body: `Fans of ${show.headliner} pick ${sponsor} far more often than the average concert-goer. ${top.name} adds a younger crowd from the neighbourhoods where your brand is growing.` },
      { heading: "What we propose", body: "A sampling bar next to merch, your logo on the promo links we send to each neighbourhood, and a shout-out from the stage before the headliner's set." },
      { heading: "What you get", body: `Reach to ${cap} fans on the night, a tracked link per neighbourhood so you can see who came through you, and photo rights for your channels.` },
      { heading: "Next step", body: "A 20-minute call this week to agree on the activation and the fee." },
    ];
  } else if (template === "memo") {
    to = "Talent buying team";
    headline = `Book ${top.name} for ${show.headliner}`;
    sections = [
      { heading: "Recommendation", body: `Offer ${top.name} the support slot for ${show.headliner} at ${where}, ${show.date}. Hold ${alt1.name} as first alternate and ${alt2.name} as second.` },
      { heading: "Evidence", body: `${top.why} Score ${top.score.toFixed(2)} against ${alt1.score.toFixed(2)} for ${alt1.name}.` },
      { heading: "Risks", body: `${top.name}'s heat is strongest away from the venue's usual crowd, so the local push has to land. If the presale stays flat at two weeks out, move spend to the headliner's own neighbourhoods.` },
      { heading: "Ask", body: `Approve a guarantee within the support budget for a ${cap}-cap room and two weeks of neighbourhood ads.` },
    ];
  } else {
    to = `${show.headliner} management`;
    headline = `${top.name} for ${show.headliner}`;
    sections = [
      { heading: "Summary", body: `We propose ${top.name} to open for ${show.headliner} at ${where}, on ${show.date}. Their fans rate ${show.headliner} highly, and they live in the parts of the city where today's presale is thinnest.` },
      { heading: "Why this pairing sells", body: `${top.why} The added crowd sits mostly in ${hoods}.` },
      { heading: "Local push", body: `Two weeks of neighbourhood ads in ${hoods}, ${partners}, and one promo link per segment so the door count shows what worked.` },
      { heading: "Terms to confirm", body: `A 30-minute set, a guarantee within the support budget for a ${cap}-cap room, and shared backline. Alternates: ${alt1.name} and ${alt2.name}.` },
    ];
  }

  return {
    template,
    to,
    headline,
    title: `${templateOf(template).label} · ${show.headliner}, ${show.city}`,
    sections: sections.map((s) => ({ ...s, id: sid() })),
  };
}
