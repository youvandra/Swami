import { NextResponse } from "next/server";
import { supabaseForUser } from "@/lib/db/server";

// Magic links and Google sign-in land here with a one-time code.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (code) {
    const sb = await supabaseForUser();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      await sb.rpc("accept_invites");
      return NextResponse.redirect(new URL(safe, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
