import { accountsOn } from "@/lib/db/config";
import { DbError, bootstrap, currentWorkspace } from "@/lib/db/repo";
import { supabaseForUser } from "@/lib/db/server";

export const dynamic = "force-dynamic";

// Everything /app shows on load, in one call.
export async function GET() {
  if (!accountsOn) return Response.json({ error: "Accounts are off on this server" }, { status: 404 });
  const sb = await supabaseForUser();
  const ws = await currentWorkspace(sb);
  if (!ws) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    return Response.json(await bootstrap(sb, ws.id));
  } catch (e) {
    console.error(JSON.stringify({ at: "bootstrap", error: e instanceof DbError ? e.message : String(e) }));
    return Response.json({ error: "Could not load the workspace" }, { status: 500 });
  }
}
