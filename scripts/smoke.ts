// Asks a running server one question per kind of answer and checks what streams back.
// Run: node scripts/smoke.ts [base], default http://localhost:5192. Works on the fake fixture and on live data.
// With accounts on it signs in SMOKE_EMAIL (a test-only user, created with the service key) and sends that session.

import { artifactSchema } from "../src/lib/agent/artifact.schema.ts";
import type { AgentEvent } from "../src/lib/agent/events.ts";
import { readEvents } from "../src/lib/sse.ts";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:5192";
const headliner = process.env.SMOKE_HEADLINER ?? "Marlow Vane";
const city = process.env.SMOKE_CITY ?? "Chicago";

const asks: [string, string[]][] = [
  [`Find an opener for ${headliner} in ${city}, Mar 14.`, ["opener_ranking", "crowd_map"]],
  [`Which cities should ${headliner} play on a Midwest leg in March?`, ["routing"]],
  [`Which venue fits ${headliner} in ${city} for 1,100 people?`, ["venues"]],
  [`Find co-promo partners in ${city} for ${headliner}.`, ["partners"]],
  [`Find sponsors whose customers love ${headliner}.`, ["sponsors"]],
  [`Who is the audience for ${headliner} in ${city}? Age and gender.`, ["audience"]],
  [`Write a proposal for ${headliner} in ${city}, Mar 14, addressed to their management.`, ["proposal"]],
  [`Draft an email to the venue to hold Mar 14 for ${headliner} in ${city}.`, ["email"]],
];

/** Cookie header for a signed-in test user, or "" when accounts are off or no test user is set up. */
async function login(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.SMOKE_EMAIL, password = process.env.SMOKE_PASSWORD;
  if (!url || !anon || !email || !password) return "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error && !/already/i.test(error.message)) throw new Error(`smoke user: ${error.message}`);
  }
  const jar = new Map<string, string>();
  const sb = createServerClient(url, anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (list) => list.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`smoke login: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}
const cookie = await login();
console.log(cookie ? `signed in as ${process.env.SMOKE_EMAIL}` : "no session (accounts off, or SWAMI_DEV_NO_AUTH on the server)");

let failed = 0;
for (const [text, want] of asks) {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream", ...(cookie && { cookie }) },
    body: JSON.stringify({ conversationId: `smoke-${t0}`, mode: "auto", messages: [{ role: "user", text }], context: { workspace: "Smoke Test", role: "Promoter", cities: [city] } }),
  });
  const kinds: string[] = [];
  let done: Extract<AgentEvent, { type: "done" }> | undefined;
  const problems: string[] = [];
  if (!res.ok || !res.body) problems.push(`HTTP ${res.status}`);
  else
    for await (const e of readEvents<AgentEvent>(res.body)) {
      kinds.push(e.type);
      if (e.type === "done") done = e;
      if (e.type === "error") problems.push(e.message);
    }
  const got = done?.message.artifacts?.map((a) => a.type) ?? [];
  if (!done) problems.push("no done event");
  for (const w of want) if (!got.includes(w as never)) problems.push(`missing ${w}`);
  for (const a of done?.message.artifacts ?? []) if (!artifactSchema.safeParse(a).success) problems.push(`invalid ${a.type}`);
  if (kinds.indexOf("step") > kinds.indexOf("done")) problems.push("steps after done");
  const failedSteps = done?.message.steps?.filter((s) => s.status === "failed").map((s) => `${s.label}: ${s.detail}`) ?? [];
  console.log(`${problems.length ? "FAIL" : "ok  "} ${(Date.now() - t0).toString().padStart(5)} ms  ${want.join("+").padEnd(28)} ${problems.join("; ")}${failedSteps.length ? `  [failed steps: ${failedSteps.join(" | ")}]` : ""}`);
  if (problems.length) failed++;
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
