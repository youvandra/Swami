// Runtime check of the Artifact union in types.ts. Tool output, edits sent to the API and imports all pass through it.

import { z } from "zod";
import type { Artifact } from "./types.ts";

const unit = z.number().min(0).max(1);
const show = z.object({ headliner: z.string().min(1), city: z.string().min(1), date: z.string(), venue: z.string(), capacity: z.number().int().positive() });
const base = { id: z.string().min(1), title: z.string().min(1), subtitle: z.string() };

const openerRow = z.object({ name: z.string().min(1), genre: z.string(), fit: unit, reachGain: unit, score: unit, why: z.string().min(1), hoods: z.array(z.string()), onRoster: z.boolean(), rising: z.boolean(), estimated: z.boolean() });
const hood = z.object({ name: z.string().min(1), x: z.number(), y: z.number(), headliner: unit, opener: unit });
const section = z.object({ id: z.string().optional(), heading: z.string(), body: z.string() });

export const artifactSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("opener_ranking"), show, rows: z.array(openerRow).min(1) }),
  z.object({ ...base, type: z.literal("crowd_map"), show, opener: z.string().min(1), hoods: z.array(hood).min(1) }),
  z.object({
    ...base,
    type: z.literal("proposal"),
    show,
    template: z.enum(["promoter", "sponsor", "memo"]).optional(),
    headline: z.string().optional(),
    to: z.string(),
    from: z.string(),
    date: z.string(),
    sections: z.array(section).min(1),
    picks: z.array(z.object({ name: z.string(), score: unit, why: z.string() })),
    facts: z.object({ hoods: z.array(z.string()), partners: z.array(z.string()), sponsor: z.string().optional() }).optional(),
  }),
  z.object({ ...base, type: z.literal("routing"), show, leg: z.string(), stops: z.array(z.object({ city: z.string(), region: z.string(), affinity: unit, milesFromPrev: z.number().int().min(0), room: z.string(), note: z.string() })).min(1) }),
  z.object({ ...base, type: z.literal("venues"), show, venues: z.array(z.object({ name: z.string(), hood: z.string(), capacity: z.number().int().positive().optional(), fit: unit, tags: z.array(z.string()), note: z.string() })).min(1) }),
  z.object({ ...base, type: z.literal("partners"), show, partners: z.array(z.object({ name: z.string(), kind: z.enum(["Bar", "Restaurant", "Record shop", "Café"]), hood: z.string(), fit: unit, angle: z.string() })).min(1) }),
  z.object({ ...base, type: z.literal("sponsors"), show, sponsors: z.array(z.object({ brand: z.string(), category: z.string(), fit: unit, lift: z.number().positive(), pitch: z.string() })).min(1) }),
  z.object({
    ...base,
    type: z.literal("audience"),
    show,
    opener: z.string(),
    audience: z.object({
      ages: z.array(z.object({ band: z.string(), headliner: unit, opener: unit })).min(1),
      women: z.object({ headliner: unit, opener: unit }),
      traits: z.array(z.object({ label: z.string(), headliner: z.string(), opener: z.string() })),
    }),
  }),
  z.object({ ...base, type: z.literal("email"), show, to: z.string(), cc: z.string(), subject: z.string().min(1), body: z.string().min(1) }),
]);

// Fails to compile when the schema and the Artifact type drift apart.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _sync: Same<z.infer<typeof artifactSchema>["type"], Artifact["type"]> = true;
void _sync;

export const isArtifact = (a: unknown): a is Artifact => artifactSchema.safeParse(a).success;
