"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { accountsOn, googleOn } from "@/lib/db/config";
import { supabaseBrowser } from "@/lib/db/browser";
import { CHICAGO_HOODS, MAP_H, MAP_W, buildDots } from "@/lib/crowdmap";
import { site } from "@/lib/site";
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
      <Showcase />
      <section className={s.side}>
        <div className={s.top}>
          <Link href="/" className={s.brand} aria-label="Swami home">
            <Logo className={s.logo} />
            <span>{site.name}</span>
          </Link>
          <Link href="/" className={s.back}>
            Back to site
          </Link>
        </div>
        <div className={s.card}>
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
              {googleOn && (
                <>
                  <div className={s.or}>or</div>
                  <button className={s.alt} onClick={google}>
                    Continue with Google
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <p className={s.legal}>Built on Qloo taste data. Every number comes from code.</p>
      </section>
    </main>
  );
}

/** The left half: the crowd map from the landing page, on navy, with the one line that says what Swami does. */
function Showcase() {
  const dots = useMemo(() => buildDots(CHICAGO_HOODS, "gain"), []);
  return (
    <aside className={s.show} aria-hidden="true">
      <div className={s.showCopy}>
        <span className={s.kicker}>Added crowd</span>
        <p className={s.pitch}>{site.tagline}</p>
      </div>
      <svg className={s.map} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        {dots.map((d) => (
          <rect key={`${d.x}-${d.y}`} x={d.x} y={d.y} width={d.size} height={d.size} rx={1} fill={d.fill} />
        ))}
      </svg>
      <ul className={s.legend}>
        <li>
          <i className={s.dim} />
          Where the headliner already sells
        </li>
        <li>
          <i className={s.bright} />
          Where the opener adds fans
        </li>
      </ul>
    </aside>
  );
}
