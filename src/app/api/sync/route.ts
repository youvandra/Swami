import { z } from "zod";
import { accountsOn } from "@/lib/db/config";
import { DbError, LimitError, apply, currentWorkspace } from "@/lib/db/repo";
import { supabaseForUser } from "@/lib/db/server";
import { opSchema } from "@/lib/db/sync";

export const dynamic = "force-dynamic";

const body = z.object({ ops: z.array(opSchema).min(1).max(200) });

// Applies the store's writes in order. Row-level security is the backstop; a Viewer's write fails here.
export async function POST(req: Request) {
  if (!accountsOn) return Response.json({ error: "Accounts are off on this server" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid change", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const sb = await supabaseForUser();
  const ws = await currentWorkspace(sb);
  if (!ws) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (ws.role === "Viewer") return Response.json({ error: "Viewers can read this workspace; ask an owner for edit access." }, { status: 403 });
  let done = 0;
  try {
    for (const op of parsed.data.ops) {
      await apply(sb, ws.id, op);
      done++;
    }
    return Response.json({ ok: true, done });
  } catch (e) {
    if (e instanceof LimitError) return Response.json({ error: e.message, done }, { status: 429 });
    console.error(JSON.stringify({ at: "sync", done, error: e instanceof DbError ? e.message : String(e) }));
    return Response.json({ error: "Could not save that change", done }, { status: 500 });
  }
}
