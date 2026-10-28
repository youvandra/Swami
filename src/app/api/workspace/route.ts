import { z } from "zod";
import { accountsOn } from "@/lib/db/config";
import { WS_COOKIE, memberships } from "@/lib/db/repo";
import { supabaseForUser } from "@/lib/db/server";

export const dynamic = "force-dynamic";

// Picks which of the user's workspaces this browser opens.
export async function POST(req: Request) {
  if (!accountsOn) return Response.json({ error: "Accounts are off on this server" }, { status: 404 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid workspace" }, { status: 400 });
  const all = await memberships(await supabaseForUser());
  if (!all.some((w) => w.id === parsed.data.id)) return Response.json({ error: "You are not a member of that workspace" }, { status: 403 });
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${WS_COOKIE}=${parsed.data.id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly; Secure`);
  return res;
}
