import type { Artifact, ArtifactType } from "@/lib/agent/types";
import { IconChart, IconDoc, IconList, IconMail, IconMap, IconPin, IconRoute, IconStore, IconTag } from "../icons";

export const ARTIFACT_LABEL: Record<ArtifactType, string> = {
  opener_ranking: "Opener ranking",
  crowd_map: "Crowd map",
  proposal: "Proposal",
  routing: "Routing",
  venues: "Venues",
  partners: "Co-promo",
  sponsors: "Sponsors",
  audience: "Audience",
  email: "Email",
};

const ICON: Record<ArtifactType, (p: { className?: string; weight?: "regular" | "duotone" | "fill" }) => React.ReactNode> = {
  opener_ranking: IconList,
  crowd_map: IconMap,
  proposal: IconDoc,
  routing: IconRoute,
  venues: IconPin,
  partners: IconStore,
  sponsors: IconTag,
  audience: IconChart,
  email: IconMail,
};

export const artifactIcon = (t: ArtifactType) => ICON[t];

// One line that says what the artifact concluded, for cards and lists.
export function artifactSummary(a: Artifact): string {
  switch (a.type) {
    case "opener_ranking":
      return `Top pick ${a.rows[0].name} · ${a.rows[0].score.toFixed(2)}`;
    case "crowd_map":
      return `${a.opener} adds crowd in ${a.hoods.filter((h) => h.opener > h.headliner).length} neighbourhoods`;
    case "proposal":
      return `${a.picks[0].name} to open · ${a.sections.length} sections`;
    case "routing":
      return `${a.stops.length} stops · strongest ${[...a.stops].sort((x, y) => y.affinity - x.affinity)[0].city}`;
    case "venues":
      return `Best fit ${a.venues[0].name}${a.venues[0].capacity ? ` · ${a.venues[0].capacity.toLocaleString("en-US")} cap` : ""}`;
    case "partners":
      return `${a.partners.length} partners · top ${a.partners[0].name}`;
    case "sponsors":
      return `Top ${a.sponsors[0].brand} · ${a.sponsors[0].lift.toFixed(1)}× lift`;
    case "audience": {
      const u30 = (k: "headliner" | "opener") => Math.round(a.audience.ages.slice(0, 2).reduce((n, g) => n + g[k], 0) * 100);
      return `Under 30: ${u30("headliner")}% → ${u30("opener")}%`;
    }
    case "email":
      return a.subject;
  }
}

export function timeAgo(t: number, now = Date.now()) {
  const m = Math.round((now - t) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
