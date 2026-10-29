import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseForUser } from "@/lib/db/server";
import { safeNext } from "@/lib/safe-next";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

// Sign-in links land here. Email links carry a token hash, which works in any browser (the email app's own
// included); Google sign-in and older email links carry a one-time code, which only works in the browser that
// asked for it.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const safe = safeNext(next);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let failed = url.searchParams.get("error_code") ?? (code || tokenHash ? "" : "link");
  if (!failed) {
    const sb = await supabaseForUser();
    const { error } =
      tokenHash && type && OTP_TYPES.includes(type) ? await sb.auth.verifyOtp({ token_hash: tokenHash, type }) : await sb.auth.exchangeCodeForSession(code ?? "");
    if (!error) {
      await sb.rpc("accept_invites");
      return NextResponse.redirect(new URL(safe, url.origin));
    }
    failed = error.code ?? "link";
  }
  const back = new URL("/login", url.origin);
  back.searchParams.set("error", failed);
  if (next) back.searchParams.set("next", safe);
  return NextResponse.redirect(back);
}
