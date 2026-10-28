import type { Artifact } from "@/lib/agent/types";

/** Where an artifact's numbers came from, for its footnote. */
export const isLive = (a: Pick<Artifact, "source">) => a.source === "live";
export const sourceOf = (a: Pick<Artifact, "source">, what = "taste graph") => (isLive(a) ? `the Qloo ${what}` : "made-up demo data");
