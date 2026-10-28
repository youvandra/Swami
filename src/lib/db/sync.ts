// The write operations the client store sends to the server, one per store action. Shared by both sides.

import { z } from "zod";
import { artifactSchema } from "../agent/artifact.schema.ts";

const id = z.string().min(1).max(64);
const step = z.object({ label: z.string(), detail: z.string().optional(), ms: z.number(), status: z.enum(["running", "done", "failed"]).optional() });
const choices = z.object({ prompt: z.string(), key: z.string(), options: z.array(z.object({ id: z.string(), name: z.string(), image: z.string().optional(), detail: z.string(), reply: z.string() })) });
const message = z.object({ id, role: z.enum(["user", "assistant"]), text: z.string().max(20_000), createdAt: z.number(), steps: z.array(step).optional(), artifacts: z.array(artifactSchema).optional(), choices: choices.optional(), failed: z.boolean().optional() });

export const conversationSchema = z.object({
  id,
  title: z.string().max(200),
  projectId: id.optional(),
  mode: z.enum(["auto", "opener", "map", "routing", "venues", "partners", "sponsors", "audience", "proposal", "email"]),
  updatedAt: z.number(),
  messages: z.array(message).max(400),
  entities: z.record(z.string(), z.string()).optional(),
});

export const projectSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  kind: z.enum(["show", "tour"]),
  tone: z.string().max(20),
  headliner: z.string().max(120),
  city: z.string().max(80),
  date: z.string().max(60),
  venue: z.string().max(120),
  capacity: z.number().int().positive().max(200_000),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const rosterSchema = z.object({ id, name: z.string().min(1).max(200), acts: z.array(z.object({ name: z.string().max(200), genre: z.string().max(80).optional() })).max(500), createdAt: z.number() });

const role = z.enum(["Owner", "Editor", "Viewer"]);

export const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("conversation.put"), conversation: conversationSchema }),
  z.object({ op: z.literal("conversation.delete"), id }),
  z.object({ op: z.literal("project.put"), project: projectSchema }),
  z.object({ op: z.literal("project.delete"), id }),
  z.object({ op: z.literal("saved.put"), projectId: id, artifactId: id, conversationId: id.optional() }),
  z.object({ op: z.literal("saved.delete"), projectId: id, artifactId: id }),
  z.object({ op: z.literal("artifact.put"), artifact: artifactSchema }),
  z.object({
    op: z.literal("workspace.patch"),
    patch: z.object({ name: z.string().min(1).max(120), role: z.enum(["promoter", "buyer", "agent", "manager"]), cities: z.array(z.string().max(80)).max(20), artists: z.array(z.string().max(120)).max(50), plan: z.enum(["single", "season", "group"]), onboarded: z.boolean() }).partial(),
  }),
  z.object({ op: z.literal("member.invite"), email: z.string().email().max(200), role }),
  z.object({ op: z.literal("member.patch"), id, patch: z.object({ role, name: z.string().max(120) }).partial() }),
  z.object({ op: z.literal("member.remove"), id }),
  z.object({ op: z.literal("roster.put"), roster: rosterSchema }),
  z.object({ op: z.literal("roster.delete"), id }),
]);

export type Op = z.infer<typeof opSchema>;
