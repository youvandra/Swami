import { accountsOn } from "@/lib/db/config";
import { currentWorkspace } from "@/lib/db/repo";
import { supabaseForUser } from "@/lib/db/server";

export const dynamic = "force-dynamic";

// This month's chat runs and Qloo calls for the workspace, for Settings → Billing.
export async function GET() {
  if (!accountsOn) return Response.json({ error: "Accounts are off on this server" }, { status: 404 });
  const sb = await supabaseForUser();
  const ws = await currentWorkspace(sb);
  if (!ws) return Response.json({ error: "Not signed in" }, { status: 401 });
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const { data, error } = await sb.from("usage_events").select("qloo_calls").eq("workspace_id", ws.id).eq("kind", "chat").gte("created_at", since.toISOString()).limit(100_000);
  if (error) return Response.json({ error: "Could not read usage" }, { status: 500 });
  return Response.json({ runs: data.length, qlooCalls: data.reduce((n, r) => n + (r.qloo_calls ?? 0), 0), since: since.toISOString() });
}
