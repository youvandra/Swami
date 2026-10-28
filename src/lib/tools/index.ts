// The tool registry: one zod schema per tool, shared by the agent (as JSON Schema) and the no-LLM router.

import { z } from "zod";
import { plainError, type ToolContext } from "./context.ts";
import * as T from "./tools.ts";

const show = {
  headliner: z.string().min(1).describe("Headliner name, exactly as resolved by search_artist"),
  city: z.string().optional().describe("City of the show; defaults to the project's city"),
  date: z.string().optional().describe("Show date as the user wrote it, e.g. 'Mar 14'"),
  venue: z.string().optional(),
  capacity: z.number().int().positive().optional(),
};
const opener = { opener: z.string().optional().describe("Opener name; defaults to the top of the ranking") };
const pick = { exclude: z.array(z.string()).optional().describe("Acts to leave out of the ranking"), risingOnly: z.boolean().optional() };

export const TOOLS = {
  search_artist: {
    description: "Look an artist up by name. Call it for every artist name the chat has not resolved yet. If the result says ambiguous, stop and ask which one.",
    input: z.object({ name: z.string().min(1), take: z.number().int().min(1).max(8).optional() }),
    run: async (ctx: ToolContext, i: { name: string; take?: number }) => {
      const r = await T.searchArtist(ctx, i);
      return { facts: { ...r, candidates: r.candidates.map(({ image: _, ...c }) => c) }, search: r };
    },
  },
  rank_openers: {
    description: "Rank opening acts for a headliner's show: fit (their fans love the act) and reach gain (the act's fans live where the headliner is weak). Uses the attached roster when there is one.",
    input: z.object({ ...show, ...pick }),
    run: T.rankOpenersTool,
  },
  crowd_map: { description: "Map of the added crowd an opener brings, by neighbourhood.", input: z.object({ ...show, ...opener, ...pick }), run: T.crowdMapTool },
  route_tour: {
    description: "Order a tour leg: cities ranked by fan affinity, then a drivable route.",
    input: z.object({ headliner: show.headliner, region: z.enum(["Midwest", "Northeast", "South", "West"]).optional(), abroad: z.string().optional().describe("A place outside the US the user asked to route through, e.g. Asia"), cities: z.array(z.string()).optional(), anchorCity: z.string().optional(), stops: z.number().int().min(2).max(14).optional(), date: show.date, capacity: show.capacity }),
    run: T.routeTourTool,
  },
  find_venues: { description: "Venues in the city ranked by how often the headliner's fans go there.", input: z.object({ headliner: show.headliner, city: show.city, capacity: show.capacity, date: show.date }), run: T.findVenuesTool },
  find_partners: { description: "Bars, restaurants, record shops and cafés for co-promotion, inside the added-crowd neighbourhoods.", input: z.object({ ...show, ...opener, ...pick, kinds: z.array(z.enum(["Bar", "Restaurant", "Record shop", "Café"])).optional() }), run: T.findPartnersTool },
  match_sponsors: { description: "Brands the headliner's fans pick more than average, with lift.", input: z.object({ headliner: show.headliner, city: show.city, date: show.date, categories: z.array(z.string()).optional() }), run: T.matchSponsorsTool },
  audience: { description: "Age, gender and taste of the headliner's and the opener's fans, side by side.", input: z.object({ ...show, ...opener, ...pick }), run: T.audienceTool },
  draft_proposal: {
    description: "Draft a proposal from the ranking: promoter (to the headliner's management), sponsor (to a brand), or memo (internal).",
    input: z.object({ ...show, ...opener, ...pick, template: z.enum(["promoter", "sponsor", "memo"]).optional(), sponsor: z.string().optional() }),
    run: T.draftProposalTool,
  },
  draft_email: {
    description: "Draft an email to the opener, a venue, a co-promo partner or a sponsor.",
    input: z.object({ ...show, ...opener, ...pick, kind: z.enum(["opener", "venue", "partner", "sponsor"]), to: z.string().optional().describe("Who the email is addressed to, by name") }),
    run: T.draftEmailTool,
  },
} as const;

export type ToolName = keyof typeof TOOLS;

/** JSON Schema definitions in a fixed order, so the prompt prefix stays cacheable. */
export function toolDefinitions() {
  return (Object.keys(TOOLS) as ToolName[]).map((name) => ({ name, description: TOOLS[name].description, input_schema: z.toJSONSchema(TOOLS[name].input) as { type: "object"; [k: string]: unknown } }));
}

export type ToolOutcome = { name: ToolName; ok: true; facts: Record<string, unknown>; artifact?: import("../agent/types.ts").Artifact; search?: Awaited<ReturnType<typeof T.searchArtist>> } | { name: ToolName; ok: false; error: string };

/** Validate and run one tool. Bad input and tool failures come back as results, never as throws. */
/** `extra` is server-side input the model never sees, such as the attached roster. */
export async function runTool(ctx: ToolContext, name: string, input: unknown, extra: Record<string, unknown> = {}): Promise<ToolOutcome> {
  if (!(name in TOOLS)) return { name: name as ToolName, ok: false, error: `Unknown tool ${name}` };
  const tool = TOOLS[name as ToolName];
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) return { name: name as ToolName, ok: false, error: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each tool's input matches its own schema
    const r = (await (tool.run as any)(ctx, { ...parsed.data, ...extra })) as { facts: Record<string, unknown>; artifact?: import("../agent/types.ts").Artifact; search?: Awaited<ReturnType<typeof T.searchArtist>> };
    if (r.artifact) r.artifact.source = ctx.q.mode;
    return { name: name as ToolName, ok: true, ...r };
  } catch (e) {
    return { name: name as ToolName, ok: false, error: plainError(e) };
  }
}
