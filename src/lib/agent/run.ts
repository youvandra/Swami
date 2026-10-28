import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.ts";
import { qlooForRun } from "../qloo/index.ts";
import { makeContext, uid } from "../tools/context.ts";
import type { Emit } from "./events.ts";
import { agentTurn, type Usage } from "./llm.ts";
import { templateTurn, type TurnResult } from "./turn.ts";
import type { ChatRequest, Message } from "./types.ts";

let client: Anthropic | undefined;

export type RunSummary = { message: Message; title: string; entities: Record<string, string>; mode: "agent" | "template"; qlooCalls: number; usage: Usage; ms: number };

/** One chat turn: the agent when a model is configured, template mode otherwise or when the agent fails. */
export async function runChat(req: ChatRequest, emit: Emit, signal?: AbortSignal): Promise<RunSummary> {
  const t0 = Date.now();
  const q = qlooForRun();
  const ctx0 = req.context;
  const project = ctx0?.project;
  const ctx = makeContext(q, {
    defaults: project ? { ...project } : { city: ctx0?.cities?.[0] },
    entities: { ...(ctx0?.entities ?? {}) },
    workspace: ctx0?.workspace ?? "Your team",
    onStep: (step) => emit({ type: "step", step }),
  });
  const usage: Usage = { input: 0, output: 0 };
  let turn: TurnResult | undefined;
  let mode: RunSummary["mode"] = "template";
  if (env.agentMode === "anthropic") {
    try {
      client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 });
      turn = await agentTurn(client, env.SWAMI_MODEL, ctx, req, emit, usage, signal);
      mode = "agent";
    } catch (e) {
      if (signal?.aborted) throw e;
      console.warn(JSON.stringify({ at: "agent", fallback: "template", error: e instanceof Error ? e.message : String(e) }));
    }
  }
  // A failed agent turn may have emitted artifacts already; template mode starts the reply over.
  turn ??= await templateTurn(ctx, req, emit);
  const message: Message = { id: uid(), role: "assistant", text: turn.text, createdAt: Date.now(), steps: ctx.steps.map(({ label, detail, ms, status }) => ({ label, detail, ms, status })), artifacts: turn.artifacts, choices: turn.choices };
  return { message, title: turn.title, entities: ctx.entities, mode, qlooCalls: q.calls, usage, ms: Date.now() - t0 };
}
