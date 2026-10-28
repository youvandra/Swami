import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// What this server runs on, so the UI labels demo data as demo and live data as live.
export function GET() {
  return Response.json({ data: env.qlooLive ? "live" : "fixture", agent: env.agentMode === "template" ? "templates" : "model", accounts: env.dbMode === "supabase" });
}
