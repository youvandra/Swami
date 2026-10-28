// What every tool gets: a Qloo source, a step recorder with real timings, and the show it works on.
// Pure (no server-only import), so the contract tests run the tools on the fixture under plain node.

import type { Show, Step } from "../agent/types.ts";
import type { Entity, QlooSource } from "../qloo/types.ts";

export type StepSink = (step: Step & { key: string }) => void;

export type ToolContext = {
  q: QlooSource;
  /** Called when a step starts (status running) and again when it ends. */
  onStep?: StepSink;
  steps: Step[];
  /** Show defaults from the project or workspace; tool inputs override them. */
  defaults: Partial<Show>;
  /** Names already resolved in this chat (lower-case name -> id), and what this run resolves. */
  entities: Record<string, string>;
  /** Entities seen in this run, by id. */
  seen: Map<string, Entity>;
  workspace: string;
  /** Memo for results several tools share in one run (e.g. the ranking behind a map and a proposal). */
  memo: Map<string, Promise<unknown>>;
};

export function makeContext(q: QlooSource, opts: Partial<Omit<ToolContext, "q" | "steps" | "seen" | "memo">> = {}): ToolContext {
  return { q, steps: [], seen: new Map(), memo: new Map(), defaults: {}, entities: {}, workspace: "Your team", ...opts };
}

let stepSeq = 0;

/** Time one unit of work and record it as a step. A throw is recorded as a failed step and rethrown. */
export async function step<T>(ctx: ToolContext, label: string, work: () => Promise<T>, detail?: (r: T) => string): Promise<T> {
  const key = `s${++stepSeq}`;
  const t0 = performance.now();
  ctx.onStep?.({ key, label, ms: 0, status: "running" });
  try {
    const r = await work();
    const done: Step = { label, detail: detail?.(r), ms: Math.round(performance.now() - t0), status: "done" };
    ctx.steps.push(done);
    ctx.onStep?.({ key, ...done });
    return r;
  } catch (e) {
    const failed: Step = { label, detail: plainError(e), ms: Math.round(performance.now() - t0), status: "failed" };
    ctx.steps.push(failed);
    ctx.onStep?.({ key, ...failed });
    throw e;
  }
}

/** Shared work inside one run: the second caller gets the first caller's promise. */
export function once<T>(ctx: ToolContext, key: string, work: () => Promise<T>): Promise<T> {
  if (!ctx.memo.has(key)) ctx.memo.set(key, work());
  return ctx.memo.get(key) as Promise<T>;
}

export class ToolError extends Error {}

export function plainError(e: unknown): string {
  if (e instanceof ToolError || (e instanceof Error && e.name === "BudgetExceeded")) return e.message;
  const m = e instanceof Error ? e.message : String(e);
  if (/Qloo (429|5\d\d)|timeout|aborted|fetch failed/i.test(m)) return "Qloo is not answering; try again in a minute.";
  return m.slice(0, 160);
}

/** Resolve an artist by id or name: chat memory first, then the top search hit. */
export async function resolveArtist(ctx: ToolContext, nameOrId: string): Promise<Entity> {
  const known = ctx.seen.get(nameOrId);
  if (known) return known;
  const key = nameOrId.trim().toLowerCase();
  const id = ctx.entities[key];
  if (id && ctx.seen.has(id)) return ctx.seen.get(id)!;
  const hits = await once(ctx, `search:${key}`, () => ctx.q.search(nameOrId, "artist", 5));
  // the remembered id, else the exact name, else the top hit
  const exact = hits.find((h) => h.name.trim().toLowerCase() === key);
  const hit = (id && hits.find((h) => h.id === id)) || exact || hits[0];
  if (!hit) throw new ToolError(`No artist called “${nameOrId}” in the taste graph.`);
  ctx.seen.set(hit.id, hit);
  ctx.entities[key] = hit.id;
  return hit;
}

/** Room size used when neither the ask nor the project gives one; artifacts that depend on it say so. */
export const ASSUMED_CAPACITY = 1000;
export const capacityAssumed = (ctx: ToolContext, input: { capacity?: number }) => input.capacity === undefined && ctx.defaults.capacity === undefined;

export function showOf(ctx: ToolContext, input: { headliner: string; city?: string; date?: string; venue?: string; capacity?: number }): Show {
  const d = ctx.defaults;
  return {
    headliner: input.headliner,
    city: input.city ?? d.city ?? "Chicago",
    date: input.date ?? d.date ?? "Date TBC",
    venue: input.venue ?? d.venue ?? "",
    capacity: input.capacity ?? d.capacity ?? ASSUMED_CAPACITY,
    ...(input.capacity === undefined && d.capacity === undefined ? { capacityAssumed: true } : {}),
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10);
