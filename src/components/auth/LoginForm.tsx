"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { accountsOn } from "@/lib/db/config";
import { supabaseBrowser } from "@/lib/db/browser";
import { Logo } from "../landing/Logo";
import s from "./LoginForm.module.css";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(params.get("error") ? "error" : "idle");
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
    setState(error ? "error" : "sent");
  }

  const google = () => supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });

  return (
    <main className={s.page}>
      <div className={s.card}>
        <Link href="/" className={s.brand} aria-label="Swami home">
          <Logo className={s.logo} />
        </Link>
        <h1 className={s.title}>Log in to Swami</h1>
        {!accountsOn ? (
          <>
            <p className={s.sub}>Accounts are switched off on this server, so your workspace lives in this browser.</p>
            <Link className="button button-ink" href="/app">
              Open the app
            </Link>
          </>
        ) : state === "sent" ? (
          <p className={s.sub}>
            Check <b>{email}</b> for a sign-in link. It works once and expires in an hour.
          </p>
        ) : (
          <>
            <p className={s.sub}>We email you a link; no password to remember.</p>
            <form className={s.form} onSubmit={sendLink}>
              <label className={s.field}>
                <span>Work email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@venue.com" autoFocus />
              </label>
              <button className="button button-ink" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Email me a link"}
              </button>
            </form>
            {state === "error" && <p className={s.error}>That link did not work. Ask for a new one.</p>}
            <div className={s.or}>or</div>
            <button className={s.alt} onClick={google}>
              Continue with Google
            </button>
          </>
        )}
      </div>
    </main>
  );
}
