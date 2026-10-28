import "server-only";
import { accountsOn } from "./config.ts";
import { currentWorkspace } from "./repo.ts";
import { supabaseForUser } from "./server.ts";
import { env } from "../env.ts";

export type Gate = { ok: true; who?: string; record: (u: { qlooCalls: number; tokensIn: number; tokensOut: number; ms: number }) => Promise<void> } | { ok: false; status: number; error: string };

const noop = async () => {};

/** Who may run a chat turn, and a way to count it. With accounts off there is nobody to count. */
export async function chatGate(): Promise<Gate> {
  if (!accountsOn || env.devNoAuth) return { ok: true, record: noop };
  const sb = await supabaseForUser();
  const ws = await currentWorkspace(sb);
  if (!ws) return { ok: false, status: 401, error: "Log in to ask Swami." };
  // a chat is saved to the workspace, which Viewers cannot write
  if (ws.role === "Viewer") return { ok: false, status: 403, error: "You can read this workspace. Ask an owner for edit access to chat." };
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await sb.from("usage_events").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("kind", "chat").gte("created_at", since.toISOString());
  const max = env.SWAMI_DAILY_RUNS_PER_WORKSPACE;
  if ((count ?? 0) >= max) return { ok: false, status: 429, error: `You have used today's ${max} runs. They reset at midnight UTC.` };
  const { data: auth } = await sb.auth.getUser();
  return {
    ok: true,
    who: auth.user?.id,
    record: async (u) => {
      await sb.from("usage_events").insert({ workspace_id: ws.id, kind: "chat", qloo_calls: u.qlooCalls, llm_input_tokens: u.tokensIn, llm_output_tokens: u.tokensOut, ms: u.ms });
    },
  };
}
