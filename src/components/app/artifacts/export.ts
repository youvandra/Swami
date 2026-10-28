import type { Artifact } from "@/lib/agent/types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const pct = (v: number) => Math.round(v * 100);

// Download for each artifact: a CSV for tables, Markdown for everything else.
export function toMarkdown(a: Artifact): { name: string; body: string; type: string } {
  if (a.type === "opener_ranking") {
    const head = "rank,act,genre,fit,reach_gain,score,on_roster,estimated";
    const rows = a.rows.map((r, i) => [i + 1, `"${r.name}"`, `"${r.genre}"`, r.fit, r.reachGain, r.score, r.onRoster, r.estimated].join(","));
    return { name: `${slug(a.title)}.csv`, body: [head, ...rows].join("\n"), type: "text/csv" };
  }
  if (a.type === "crowd_map") {
    const rows = a.hoods.map((h) => `| ${h.name} | ${pct(h.headliner)} | ${pct(h.opener)} | ${pct(Math.max(0, h.opener - h.headliner * 0.9))} |`);
    const body = [`# ${a.title}`, "", a.subtitle, "", "| Neighbourhood | Headliner | Opener | Added |", "|---|---|---|---|", ...rows].join("\n");
    return { name: `${slug(a.title)}.md`, body, type: "text/markdown" };
  }
  const csv = (head: string[], rows: (string | number)[][]) => ({
    name: `${slug(a.title)}.csv`,
    body: [head.join(","), ...rows.map((r) => r.map((c) => (typeof c === "string" ? `"${c.replace(/"/g, '""')}"` : c)).join(","))].join("\n"),
    type: "text/csv",
  });
  if (a.type === "routing") return csv(["order", "city", "region", "affinity", "miles_from_prev", "room", "note"], a.stops.map((s, i) => [i + 1, s.city, s.region, s.affinity, s.milesFromPrev, s.room, s.note]));
  if (a.type === "venues") return csv(["venue", "neighbourhood", "capacity", "fit", "note"], a.venues.map((v) => [v.name, v.hood, v.capacity ?? "", v.fit, v.note]));
  if (a.type === "partners") return csv(["partner", "kind", "neighbourhood", "fit", "angle"], a.partners.map((p) => [p.name, p.kind, p.hood, p.fit, p.angle]));
  if (a.type === "sponsors") return csv(["brand", "category", "fit", "lift", "pitch"], a.sponsors.map((s) => [s.brand, s.category, s.fit, s.lift, s.pitch]));
  if (a.type === "audience") {
    const rows = a.audience.ages.map((g) => `| ${g.band} | ${pct(g.headliner)}% | ${pct(g.opener)}% |`);
    const body = [`# ${a.title}`, "", `| Age | ${a.show.headliner} | ${a.opener} |`, "|---|---|---|", ...rows, "", `Women: ${pct(a.audience.women.headliner)}% vs ${pct(a.audience.women.opener)}%`].join("\n");
    return { name: `${slug(a.title)}.md`, body, type: "text/markdown" };
  }
  if (a.type === "email") {
    return { name: `${slug(a.title)}.txt`, body: `To: ${a.to}\nCc: ${a.cc}\nSubject: ${a.subject}\n\n${a.body}`, type: "text/plain" };
  }
  const body = [
    `# ${a.title}`,
    "",
    `**To:** ${a.to}  `,
    `**From:** ${a.from}  `,
    `**Date:** ${a.date}`,
    "",
    ...a.sections.flatMap((sec) => [`## ${sec.heading}`, "", sec.body, ""]),
    "## Ranked picks",
    "",
    ...a.picks.map((p, i) => `${i + 1}. **${p.name}** (${p.score.toFixed(2)}): ${p.why}`),
    "",
    "_Scores show audience affinity from the Qloo taste graph._",
  ].join("\n");
  return { name: `${slug(a.title)}.md`, body, type: "text/markdown" };
}

export function toPlainText(a: Artifact): string {
  if (a.type === "opener_ranking") return [a.title, ...a.rows.map((r, i) => `${i + 1}. ${r.name}: ${r.score.toFixed(2)}`)].join("\n");
  return toMarkdown(a).body;
}
