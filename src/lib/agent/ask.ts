import type { Artifact, Show } from "./types.ts";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The result of this kind for this show (and opener, when given), newest first; never "the first map in the chat". */
export function findArtifactFor(artifacts: Artifact[], want: { type: Artifact["type"]; headliner: string; city: string; opener?: string }): Artifact | undefined {
  for (let i = artifacts.length - 1; i >= 0; i--) {
    const a = artifacts[i];
    if (a.type !== want.type || !same(a.show.headliner, want.headliner) || !same(a.show.city, want.city)) continue;
    if (want.opener !== undefined && !("opener" in a && same(a.opener, want.opener))) continue;
    return a;
  }
  return undefined;
}

/** The question that maps one act's added crowd for a show. */
export const askMap = (show: Show, opener: string) => `Map the added crowd for ${show.headliner} with ${opener} in ${show.city}.`;

/** The question that makes this kind of result again for the same show, for "run again with fresh data". */
export function askFor(a: Artifact): string {
  const { headliner: h, city, date } = a.show;
  const when = date && date !== "Date TBC" ? `, ${date}` : "";
  switch (a.type) {
    case "opener_ranking":
      return `Find an opener for ${h} in ${city}${when}.`;
    case "crowd_map":
      return askMap(a.show, a.opener);
    case "routing":
      return `Route a tour leg for ${h}: ${a.leg}.`;
    case "venues":
      return `Which venue fits ${h} in ${city} for ${a.show.capacity.toLocaleString("en-US")} people?`;
    case "partners":
      return `Find co-promo partners in ${city} for ${h}.`;
    case "sponsors":
      return `Find sponsors whose customers love ${h}.`;
    case "audience":
      return `Who is the audience for ${h} and ${a.opener} in ${city}? Age and gender.`;
    case "proposal":
      return `Write a ${a.template === "sponsor" ? "sponsor pitch" : a.template === "memo" ? "booking memo" : "proposal"} for ${h} in ${city}${when}.`;
    case "email":
      return `Draft an email for ${h} in ${city}${when}: ${a.subject}.`;
  }
}
