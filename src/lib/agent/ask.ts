import type { Artifact } from "./types.ts";

/** The question that makes this kind of result again for the same show, for "run again with fresh data". */
export function askFor(a: Artifact): string {
  const { headliner: h, city, date } = a.show;
  const when = date && date !== "Date TBC" ? `, ${date}` : "";
  switch (a.type) {
    case "opener_ranking":
      return `Find an opener for ${h} in ${city}${when}.`;
    case "crowd_map":
      return `Map the added crowd for ${h} with ${a.opener} in ${city}.`;
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
