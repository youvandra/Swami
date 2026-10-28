import "server-only";
import { accountsOn } from "./config.ts";
import { currentWorkspace } from "./repo.ts";
import { supabaseForUser } from "./server.ts";
import { env } from "../env.ts";

export type Gate = { ok: true; record: (u: { qlooCalls: number; tokensIn: number; tokensOut: number; ms: number }) => Promise<void> } | { ok: false; status: number; error: string };

const noop = async () => {};

/** Who may run a chat turn, and a way to count it. With accounts off there is nobody to count. */
export async function chatGate(): Promise<Gate> {
  if (!accountsOn) return { ok: true, record: noop };
  const sb = await supabaseForUser();
  const ws = await currentWorkspace(sb);
  if (!ws) return { ok: false, status: 401, error: "Log in to ask Swami." };
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await sb.from("usage_events").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("kind", "chat").gte("created_at", since.toISOString());
  const max = env.SWAMI_DAILY_RUNS_PER_WORKSPACE;
  if ((count ?? 0) >= max) return { ok: false, status: 429, error: `You have used today's ${max} runs. They reset at midnight UTC.` };
  return {
    ok: true,
    record: async (u) => {
      await sb.from("usage_events").insert({ workspace_id: ws.id, kind: "chat", qloo_calls: u.qlooCalls, llm_input_tokens: u.tokensIn, llm_output_tokens: u.tokensOut, ms: u.ms });
    },
  };
}
