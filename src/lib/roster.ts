// Reads a roster from a pasted list or a CSV export.
// Accepts one act per line, "Act, Genre" lines, or a CSV whose header names an act/artist/name column.

import type { Roster } from "./model";

/** Bigger files are cut here; a roster is a list of acts, and 500 is more than any agency books in a season. */
export const ROSTER_MAX_ACTS = 500;
export const ROSTER_MAX_BYTES = 200_000;

const HEAD_NAME = /^(act|artist|name|band)s?$/i;
const HEAD_GENRE = /^(genre|style)$/i;

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if ((c === "," || c === "\t" || c === ";") && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function parseRoster(text: string): Roster["acts"] {
  const lines = text
    .slice(0, ROSTER_MAX_BYTES)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  let nameCol = 0;
  let genreCol = 1;
  const first = splitCsv(lines[0]);
  const hasHeader = first.some((c) => HEAD_NAME.test(c));
  if (hasHeader) {
    nameCol = first.findIndex((c) => HEAD_NAME.test(c));
    genreCol = first.findIndex((c) => HEAD_GENRE.test(c));
  }

  const seen = new Set<string>();
  const acts: Roster["acts"] = [];
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitCsv(line);
    const name = cells[nameCol]?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    if (acts.length >= ROSTER_MAX_ACTS) break;
    seen.add(name.toLowerCase());
    const genre = genreCol >= 0 ? cells[genreCol]?.trim() : undefined;
    acts.push(genre ? { name, genre } : { name });
  }
  return acts;
}
