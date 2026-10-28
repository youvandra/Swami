import { encodeEvent, type AgentEvent } from "@/lib/agent/events";
import { runChat } from "@/lib/agent/run";
import { uid } from "@/lib/tools/context";
import { chatGate } from "@/lib/db/usage";
import { env } from "@/lib/env";
import { limiter } from "@/lib/ratelimit";
import { z } from "zod";

// 10 runs a minute per visitor keeps one runaway tab from spending the workspace's Qloo budget
const perMinute = limiter(10, 60_000);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  conversationId: z.string().min(1).max(64),
  mode: z.enum(["auto", "opener", "map", "routing", "venues", "partners", "sponsors", "audience", "proposal", "email"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(8000) })).min(1).max(200),
  context: z
    .object({
      workspace: z.string().max(120),
      role: z.string().max(60),
      cities: z.array(z.string().max(60)).max(20),
      artists: z.array(z.string().max(120)).max(50).optional(),
      roster: z.object({ name: z.string().max(120), acts: z.array(z.string().max(120)).max(500) }).optional(),
      project: z.object({ headliner: z.string().max(120), city: z.string().max(60), date: z.string().max(60), venue: z.string().max(120), capacity: z.number().int().positive().max(200_000) }).optional(),
      last: z.object({ headliner: z.string().max(120), city: z.string().max(60), date: z.string().max(60), opener: z.string().max(120).optional() }).optional(),
      entities: z.record(z.string().max(120), z.string().max(120)).optional(),
    })
    .optional(),
});

// Streams the turn as server-sent events; `Accept: application/json` gets one JSON reply (used by tests).
export async function POST(req: Request) {
  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  if (!perMinute.take(who)) {
    const wait = perMinute.retryAfter(who);
    return Response.json({ error: `That is a lot of questions at once. Try again in ${wait} seconds.` }, { status: 429, headers: { "retry-after": String(wait) } });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const chat = parsed.data;
  const gate = await chatGate();
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status });
  const requestId = uid();
  const dataMode = env.qlooLive ? "live" : "fixture";
  const log = (r: Awaited<ReturnType<typeof runChat>>) => {
    void gate.record({ qlooCalls: r.qlooCalls, tokensIn: r.usage.input, tokensOut: r.usage.output, ms: r.ms }).catch(() => {});
    console.log(JSON.stringify({ at: "chat", requestId, mode: r.mode, qlooCalls: r.qlooCalls, ms: r.ms, steps: r.message.steps?.length, failed: r.message.steps?.filter((s) => s.status === "failed").length, tokensIn: r.usage.input, tokensOut: r.usage.output }));
  };

  if (req.headers.get("accept")?.includes("application/json")) {
    const r = await runChat(chat, () => {}, req.signal);
    log(r);
    return Response.json({ message: r.message, title: r.title, entities: r.entities, dataMode });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => {
        try {
          controller.enqueue(enc.encode(encodeEvent(e)));
        } catch {
          // the client went away; the run finishes and its events are dropped
        }
      };
      try {
        const r = await runChat(chat, send, req.signal);
        log(r);
        send({ type: "title", title: r.title });
        send({ type: "done", message: r.message, title: r.title, entities: r.entities, dataMode });
      } catch (e) {
        console.error(JSON.stringify({ at: "chat", requestId, error: e instanceof Error ? e.message : String(e) }));
        send({ type: "error", message: "Swami hit a problem on that one. Try again in a moment." });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
