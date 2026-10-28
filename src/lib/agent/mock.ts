// Deterministic stand-in for the agent. It reads the request, picks the tools the real agent would call,
// and returns the same shapes the real agent will. Every name and number here is illustrative.

import { CHICAGO_HOODS } from "../crowdmap";
import { draftProposal, templateOf } from "../proposal";
import type { Artifact, ChatContext, ChatRequest, ChatResponse, Mode, OpenerRow, Show, Step } from "./types";

type Kind = Exclude<Mode, "auto">;

const uid = () => Math.random().toString(36).slice(2, 10);

const CITIES = ["Chicago", "Austin", "Seattle", "Denver", "Atlanta", "Brooklyn", "Los Angeles", "Milwaukee", "Detroit", "Minneapolis", "Jakarta", "London"];

const OPENERS: Omit<OpenerRow, "score">[] = [
  { name: "Halcyon Drive", genre: "Indie rock", fit: 0.91, reachGain: 0.86, why: "Ranks 4th of 50 among acts the headliner's fans love, and owns Logan Square and Pilsen, where the headliner runs cold.", hoods: ["Logan Square", "Pilsen"], onRoster: true, rising: true, estimated: false },
  { name: "The Low Orchard", genre: "Folk pop", fit: 0.88, reachGain: 0.7, why: "Close taste match with a strong pull in Avondale. Overlaps with the headliner in Wicker Park.", hoods: ["Avondale", "Wicker Park"], onRoster: true, rising: false, estimated: false },
  { name: "Pia Marsh", genre: "Alt R&B", fit: 0.74, reachGain: 0.81, why: "A younger crowd on the South Side. Brings people who rarely show up for the headliner.", hoods: ["Hyde Park", "Pilsen"], onRoster: false, rising: true, estimated: false },
  { name: "Copper Hours", genre: "Garage", fit: 0.69, reachGain: 0.64, why: "Steady local draw in Logan Square. Smaller footprint, so the heat is estimated from its scene.", hoods: ["Logan Square"], onRoster: true, rising: false, estimated: true },
  { name: "June Atlas", genre: "Dream pop", fit: 0.83, reachGain: 0.42, why: "Fans love both acts, and they already live where the headliner sells. Adds less new crowd.", hoods: ["Lincoln Park"], onRoster: false, rising: false, estimated: false },
  { name: "Fieldwork", genre: "Post-punk", fit: 0.58, reachGain: 0.66, why: "Looser taste match, strong in Avondale bars. A good pick for a late add.", hoods: ["Avondale"], onRoster: true, rising: true, estimated: true },
];

// score = fit^a * reachGain^b; the real scorer lives in src/lib/score and is unit-tested.
const A = 0.6;
const B = 0.4;
export const scoreOf = (fit: number, reachGain: number) => Math.round(fit ** A * reachGain ** B * 100) / 100;

function readShow(text: string): Show {
  const city = CITIES.find((c) => text.toLowerCase().includes(c.toLowerCase())) ?? "Chicago";
  const m = text.match(/\bfor ([A-Z][\w'&]*(?: [A-Z][\w'&]*){0,3})/);
  const date = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}\b/)?.[0] ?? "Mar 14";
  return { headliner: m?.[1] ?? "Marlow Vane", city, date, venue: "The Thalia Room", capacity: 1100 };
}

// Order matters: the most specific request wins.
const INTENTS: [Kind, RegExp][] = [
  ["email", /\b(email|e-mail|reach out|message|dm)\b/],
  ["proposal", /proposal|memo|deck|one-pager/],
  ["sponsors", /sponsor|brand/],
  ["partners", /partner|co-?promo|flyer|bars? |shops?|local push/],
  ["venues", /venue|room|hall|hold/],
  ["routing", /route|routing|tour leg|\bleg\b|cities/],
  ["audience", /audience|demographic|who (are|is) (the|their) fans|\bage\b|gender/],
  ["map", /map|neighbou?rhood|where .*fans|heat|added crowd/],
];

function intent(text: string, mode: Mode): Kind {
  if (mode !== "auto") return mode;
  const t = text.toLowerCase();
  return INTENTS.find(([, re]) => re.test(t))?.[0] ?? "opener";
}

// stable 0..1 from a name, so an act we have no fixture for always gets the same estimate
const unit = (s: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (const c of s.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

// With a roster attached, only its acts are ranked; acts without their own data get a scene estimate.
function rankedOpeners(roster?: ChatContext["roster"]) {
  const pool: Omit<OpenerRow, "score">[] = roster
    ? roster.acts.map((name) => {
        const known = OPENERS.find((o) => o.name.toLowerCase() === name.toLowerCase());
        if (known) return { ...known, onRoster: true };
        return {
          name,
          genre: "From roster",
          fit: Math.round((0.5 + unit(name, 1) * 0.4) * 100) / 100,
          reachGain: Math.round((0.4 + unit(name, 2) * 0.45) * 100) / 100,
          why: "Too new to have its own taste profile, so the fit is estimated from fans of its genre and scene in this city.",
          hoods: ["Logan Square"],
          onRoster: true,
          rising: unit(name, 3) > 0.6,
          estimated: true,
        };
      })
    : OPENERS;
  return pool.map((o) => ({ ...o, score: scoreOf(o.fit, o.reachGain) })).sort((a, b) => b.score - a.score);
}

const ranking = (show: Show, roster?: ChatContext["roster"]): Artifact => {
  const rows = rankedOpeners(roster);
  return {
    id: uid(),
    type: "opener_ranking",
    title: `Openers for ${show.headliner}`,
    subtitle: roster ? `${show.city} · ${show.date} · ${rows.length} acts on ${roster.name}` : `${show.city} · ${show.date} · ${rows.length} candidates`,
    show,
    rows,
  };
};

const map = (show: Show, opener: string): Artifact => ({
  id: uid(),
  type: "crowd_map",
  title: `${opener} + ${show.headliner}`,
  subtitle: `${show.city} · added crowd by neighbourhood`,
  show,
  opener,
  hoods: CHICAGO_HOODS,
});

function proposal(show: Show, text: string, ctx?: ChatContext): Artifact {
  const picks = rankedOpeners(ctx?.roster)
    .slice(0, 3)
    .map(({ name, score, why }) => ({ name, score, why }));
  const template = /sponsor|brand/i.test(text) ? "sponsor" : /memo|internal/i.test(text) ? "memo" : "promoter";
  const d = draftProposal(template, show, picks);
  return {
    id: uid(),
    type: "proposal",
    title: d.title,
    subtitle: `Draft · ${d.sections.length} sections`,
    show,
    template: d.template,
    headline: d.headline,
    to: d.to,
    from: ctx ? `${ctx.workspace}, ${ctx.role.toLowerCase()}` : "Northside Live, talent buying",
    date: "28 Oct 2026",
    picks,
    sections: d.sections,
  };
}

const routing = (show: Show): Artifact => ({
  id: uid(),
  type: "routing",
  title: `Midwest leg · ${show.headliner}`,
  subtitle: "8 cities ranked by fan affinity · suggested order",
  show,
  leg: "Midwest, March",
  stops: [
    { city: "Chicago", region: "IL", affinity: 0.94, milesFromPrev: 0, room: "1,000–1,500", note: "Anchor date. Strongest market on the leg." },
    { city: "Milwaukee", region: "WI", affinity: 0.81, milesFromPrev: 92, room: "800–1,000", note: "Short hop; fans over-index on indie rock." },
    { city: "Minneapolis", region: "MN", affinity: 0.88, milesFromPrev: 337, room: "1,000–1,500", note: "Second strongest. Worth a Saturday." },
    { city: "Kansas City", region: "MO", affinity: 0.62, milesFromPrev: 440, room: "600–800", note: "Thin today. Pair with a strong local opener." },
    { city: "St. Louis", region: "MO", affinity: 0.7, milesFromPrev: 248, room: "800–1,000", note: "Steady; good for a weeknight." },
    { city: "Indianapolis", region: "IN", affinity: 0.58, milesFromPrev: 243, room: "500–700", note: "Weakest stop. Consider a smaller room." },
    { city: "Columbus", region: "OH", affinity: 0.76, milesFromPrev: 175, room: "800–1,000", note: "College crowd skews younger than the headliner's." },
    { city: "Detroit", region: "MI", affinity: 0.84, milesFromPrev: 204, room: "1,000–1,200", note: "Close the leg here; strong late-week market." },
  ],
});

const venues = (show: Show): Artifact => ({
  id: uid(),
  type: "venues",
  title: `Rooms for ${show.headliner} in ${show.city}`,
  subtitle: "5 venues ranked by audience fit",
  show,
  venues: [
    { name: "The Thalia Room", hood: "Wicker Park", capacity: 1100, fit: 0.91, tags: ["Standing", "Bar on site", "L train"], note: "Fans of the headliner already go here for indie bills. The right size for current demand." },
    { name: "Copperline Hall", hood: "West Loop", capacity: 1500, fit: 0.84, tags: ["Seated balcony", "Late curfew"], note: "Bigger room. Pick it if the opener adds the crowd the map shows." },
    { name: "Lantern Works", hood: "Logan Square", capacity: 650, fit: 0.8, tags: ["Standing", "All ages"], note: "In the opener's strongest neighbourhood. Good for a second, smaller night." },
    { name: "The Greyhound", hood: "Pilsen", capacity: 900, fit: 0.73, tags: ["Standing", "Food hall next door"], note: "Reaches the added crowd directly. Fewer regulars from the headliner's side." },
    { name: "Riverside Assembly", hood: "Near North", capacity: 2200, fit: 0.61, tags: ["Seated", "Premium bar"], note: "Too large for this tour. Keep in mind for the next one." },
  ],
});

const partners = (show: Show): Artifact => ({
  id: uid(),
  type: "partners",
  title: `Co-promo partners · ${show.city}`,
  subtitle: "6 places whose regulars share the crowd",
  show,
  partners: [
    { name: "Two Moons Bar", kind: "Bar", hood: "Logan Square", fit: 0.92, angle: "Pre-show listening night with the opener's record on rotation; ticket link on table cards." },
    { name: "Sola Records", kind: "Record shop", hood: "Logan Square", fit: 0.89, angle: "In-store signed vinyl giveaway with every ticket bought through their promo link." },
    { name: "Calle Taqueria", kind: "Restaurant", hood: "Pilsen", fit: 0.84, angle: "Show-night combo: two tacos and a drink with a ticket stub." },
    { name: "Ninth Street Vinyl", kind: "Record shop", hood: "Pilsen", fit: 0.8, angle: "Window poster and a staff-picks shelf for both acts." },
    { name: "Hollow Pine Coffee", kind: "Café", hood: "Avondale", fit: 0.77, angle: "Flyers at the counter and a stamped card for a free coffee after the show." },
    { name: "Little Ember Pizza", kind: "Restaurant", hood: "Avondale", fit: 0.71, angle: "Late slice deal after the show for anyone with a wristband." },
  ],
});

const sponsors = (show: Show): Artifact => ({
  id: uid(),
  type: "sponsors",
  title: `Sponsors for ${show.headliner}`,
  subtitle: "5 brands whose customers love this music",
  show,
  sponsors: [
    { brand: "Northwind Cold Brew", category: "Beverage", fit: 0.9, lift: 3.4, pitch: "Fans are 3.4× likelier than average to buy it. A sampling bar at the merch table fits the room." },
    { brand: "Fieldline Outfitters", category: "Outdoor apparel", fit: 0.86, lift: 2.9, pitch: "Shares the audience's weekend habits. A co-branded tour tee is the natural ask." },
    { brand: "Lumen Audio", category: "Headphones", fit: 0.82, lift: 2.6, pitch: "Strong with the opener's younger fans. Offer a listening booth and a giveaway." },
    { brand: "Halo Seltzer", category: "Beverage", fit: 0.74, lift: 2.1, pitch: "Good bar partner for a venue with a premium bar." },
    { brand: "Tidewater Bikes", category: "Mobility", fit: 0.68, lift: 1.8, pitch: "Fits a city-cycling crowd. Valet bike parking on show night." },
  ],
});

const audience = (show: Show, opener: string): Artifact => ({
  id: uid(),
  type: "audience",
  title: `Who comes: ${show.headliner} + ${opener}`,
  subtitle: "Age, gender and taste, side by side",
  show,
  opener,
  audience: {
    ages: [
      { band: "18–24", headliner: 0.14, opener: 0.27 },
      { band: "25–29", headliner: 0.24, opener: 0.31 },
      { band: "30–34", headliner: 0.26, opener: 0.2 },
      { band: "35–44", headliner: 0.24, opener: 0.15 },
      { band: "45+", headliner: 0.12, opener: 0.07 },
    ],
    women: { headliner: 0.52, opener: 0.58 },
    traits: [
      { label: "Also listens to", headliner: "Folk, 2000s indie", opener: "Garage, alt R&B" },
      { label: "Goes out in", headliner: "Lincoln Park, West Loop", opener: "Logan Square, Pilsen" },
      { label: "Eats at", headliner: "Wine bars, bistros", opener: "Taquerias, late pizza" },
    ],
  },
});

// The draft follows whoever the request names: a sponsor, a venue, a co-promo partner, or (by default) the opener.
function email(show: Show, text: string, workspace = "Northside Live"): Artifact {
  const cap = show.capacity.toLocaleString("en-US");
  const sign = `Best,\n${workspace}`;
  const named = (re: RegExp, fallback: string) => text.match(re)?.[1]?.trim() ?? fallback;
  let d: { who: string; to: string; subject: string; body: string };
  if (/sponsor|brand/i.test(text)) {
    const who = named(/to ([A-Z][\w ]+?) (?:for|about)/, "Northwind Cold Brew");
    d = {
      who,
      to: "partnerships@brand.example",
      subject: `${show.headliner} in ${show.city}, ${show.date}: sampling partnership`,
      body: `Hi ${who} team,\n\nWe're presenting ${show.headliner} at ${show.venue} in ${show.city} on ${show.date}, a ${cap}-cap room.\n\nTheir fans buy ${who} far more often than the average concert-goer, so we'd love to set up a sampling bar next to merch, plus your logo on the promo links we send to Logan Square and Pilsen.\n\nCould we talk this week?\n\n${sign}`,
    };
  } else if (/hold|venue/i.test(text)) {
    const who = named(/Email ([A-Z][\w ]+?) to/, show.venue);
    d = {
      who,
      to: "booking@venue.example",
      subject: `Hold request: ${show.headliner}, ${show.date}`,
      body: `Hi ${who} team,\n\nWe'd like to place a first hold on ${show.date} for ${show.headliner} with support from Halcyon Drive.\n\nWe expect a full ${cap}-cap room: the pairing adds a crowd from Logan Square and Pilsen on top of the headliner's regulars.\n\nCan you confirm the date is open and send your current deal sheet?\n\n${sign}`,
    };
  } else if (/co-?promot|partner/i.test(text)) {
    const who = named(/email to ([A-Z][\w ]+?) about/, "Two Moons Bar");
    d = {
      who,
      to: "hello@partner.example",
      subject: `Co-promo idea: ${show.headliner} + Halcyon Drive, ${show.date}`,
      body: `Hi ${who},\n\nWe're putting on ${show.headliner} with Halcyon Drive at ${show.venue} on ${show.date}. A lot of your regulars are fans of both acts.\n\nWould you host a pre-show night or put our flyer on the counter? You'd get your own ticket link, a pair of guest-list spots and a shout-out in our posts.\n\n${sign}`,
    };
  } else {
    d = {
      who: "Halcyon Drive",
      to: "booking@artist.example",
      subject: `Support slot: ${show.headliner} at ${show.venue}, ${show.date}`,
      body: `Hi Halcyon Drive team,\n\nWe're booking support for ${show.headliner} at ${show.venue}, ${show.city}, on ${show.date}.\n\nYour fans rank ${show.headliner} among the acts they love most, and they live in the neighbourhoods where our presale needs a lift. We'd like to offer you the 30-minute support slot.\n\nAre you holding that date? Happy to send terms today.\n\n${sign}`,
    };
  }
  return { id: uid(), type: "email", title: `Email · ${d.who}`, subtitle: "Draft", show, to: d.to, cc: "talent@northsidelive.example", subject: d.subject, body: d.body };
}

const STEP_SETS: Record<Kind, (show: Show) => Step[]> = {
  opener: (show) => [
    { label: "Searched the taste graph", detail: `${show.headliner} → 50 related acts`, ms: 420 },
    { label: `Pulled neighbourhood heat for ${show.city}`, detail: "7 neighbourhoods, 6 acts", ms: 610 },
    { label: "Scored every act", detail: "fit × reach gain, roster filter on", ms: 90 },
  ],
  map: (show) => [
    { label: `Pulled neighbourhood heat for ${show.city}`, detail: "headliner and Halcyon Drive", ms: 610 },
    { label: "Compared fan maps", detail: "added crowd per neighbourhood", ms: 180 },
  ],
  routing: (show) => [
    { label: "Ranked cities by fan affinity", detail: `${show.headliner} across 40 US metros`, ms: 540 },
    { label: "Ordered the leg by drive time", detail: "8 stops, 1,739 miles", ms: 120 },
  ],
  venues: (show) => [
    { label: `Searched music venues in ${show.city}`, detail: "tag: live music venue", ms: 380 },
    { label: "Scored venues by audience fit", detail: `${show.headliner} fans`, ms: 260 },
  ],
  partners: (show) => [
    { label: "Found places the crowd already goes", detail: "bars, restaurants, record shops, cafés", ms: 520 },
    { label: "Filtered to the added-crowd neighbourhoods", detail: "Logan Square, Pilsen, Avondale", ms: 140 },
    { label: "Wrote an angle per partner", detail: "6 partners", ms: 860 },
  ],
  sponsors: (show) => [
    { label: "Searched brand affinity", detail: `${show.headliner} fans vs national baseline`, ms: 480 },
    { label: "Ranked brands by lift", detail: "5 brands above 1.5×", ms: 90 },
    { label: "Wrote a pitch line per brand", detail: "", ms: 740 },
  ],
  audience: (show) => [
    { label: "Pulled demographics", detail: `${show.headliner} and Halcyon Drive`, ms: 360 },
    { label: "Compared taste across domains", detail: "music, places, food", ms: 420 },
  ],
  proposal: (show) => [
    ...STEP_SETS.opener(show),
    { label: "Drafted the proposal", detail: "4 sections, 3 picks", ms: 1240 },
  ],
  email: () => [
    { label: "Read the ranking and the memo", detail: "top pick: Halcyon Drive", ms: 120 },
    { label: "Drafted the email", detail: "subject, body, recipients", ms: 820 },
  ],
};

export function mockReply(req: ChatRequest): ChatResponse {
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.text ?? "";
  const kind = intent(last, req.mode);
  const show = readShow(last);
  const ctx = req.context;
  const roster = ctx?.roster;
  const top = rankedOpeners(roster)[0];
  const opener = top.name;

  const replies: Record<Kind, () => { text: string; artifacts: Artifact[]; title: string }> = {
    opener: () => ({
      text: roster
        ? `I ranked the ${roster.acts.length} acts on ${roster.name} for ${show.headliner} in ${show.city} on ${show.date}. ${opener} leads with a score of ${top.score.toFixed(2)}. Acts without their own taste data are estimated from their scene and marked that way.`
        : `I ranked 6 acts for ${show.headliner} in ${show.city} on ${show.date}. ${opener} leads: a strong taste match, and its fans live where the headliner runs cold. Two picks are estimated from their scene because their own data is thin.`,
      artifacts: [ranking(show, roster), map(show, opener)],
      title: `${show.city}, ${show.date} · openers`,
    }),
    map: () => ({
      text: `${opener} adds the most new crowd in Logan Square and Pilsen. ${show.headliner} already owns Lincoln Park and the West Loop, so ads there mostly reach people who would come anyway.`,
      artifacts: [map(show, opener)],
      title: `${show.city} · added crowd`,
    }),
    routing: () => ({
      text: `Chicago, Minneapolis and Detroit are the strongest markets for ${show.headliner} on this leg. Indianapolis and Kansas City run thin, so I suggested smaller rooms there and a strong local opener.`,
      artifacts: [routing(show)],
      title: `Midwest leg · ${show.headliner}`,
    }),
    venues: () => ({
      text: `The Thalia Room fits current demand best. If ${opener} opens and the added crowd shows up, Copperline Hall is the step up.`,
      artifacts: [venues(show)],
      title: `${show.city} · venues`,
    }),
    partners: () => ({
      text: `Six places in Logan Square, Pilsen and Avondale share the added crowd. Two Moons Bar and Sola Records are the strongest fits; each gets its own promo link so you can see what sold.`,
      artifacts: [partners(show), map(show, opener)],
      title: `${show.city} · co-promo`,
    }),
    sponsors: () => ({
      text: `Northwind Cold Brew is the strongest match: ${show.headliner} fans are 3.4× likelier than average to buy it. Each brand comes with a one-line pitch you can send as is.`,
      artifacts: [sponsors(show)],
      title: `Sponsors · ${show.headliner}`,
    }),
    audience: () => ({
      text: `${opener} brings a younger crowd: 58% under 30, against 38% for ${show.headliner}. They also go out in different neighbourhoods, which is why the pairing adds new tickets.`,
      artifacts: [audience(show, opener)],
      title: `Audience · ${show.headliner} + ${opener}`,
    }),
    proposal: () => {
      const a = proposal(show, last, ctx);
      const label = a.type === "proposal" ? templateOf(a.template).label : "Proposal";
      return {
        text: `Here is a draft ${label.toLowerCase()} for ${show.headliner} in ${show.city}, built on ${opener} and two alternates. Edit any line on the page, switch the template, or export it to PDF or Word.`,
        artifacts: [a],
        title: `${label} · ${show.headliner}`,
      };
    },
    email: () => ({
      text: "Here is a draft. Edit the subject or body, then copy it or open it in your mail app.",
      artifacts: [email(show, last, ctx?.workspace)],
      title: `Email · ${show.headliner}`,
    }),
  };

  const r = replies[kind]();
  return {
    title: r.title,
    message: { id: uid(), role: "assistant", text: r.text, createdAt: Date.now(), steps: STEP_SETS[kind](show), artifacts: r.artifacts },
  };
}
