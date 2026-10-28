# Swami

Swami helps promoters, talent buyers, agents and artist managers book shows from taste data. Ask in a chat; the answer comes back as artifacts you can edit, save to a project and export: an opener ranking, a crowd map, a tour route, venues, co-promo partners, sponsors, an audience profile, a proposal or an email.

## Run

```bash
npm install
cp .env.example .env.local   # every key is optional
npm run dev                  # http://localhost:5192
```

With an empty `.env.local` the app runs end to end on a hand-written fake taste graph (`fixtures/fake/graph.ts`), writes its messages from templates, and keeps the workspace in the browser. Each key turns one part on:

| Key | Turns on | Without it |
| --- | --- | --- |
| `QLOO_API_KEY` (+ `QLOO_BASE_URL`) | live taste data | the fake graph, labelled "Demo data" in the app |
| `ANTHROPIC_API_KEY` (+ `SWAMI_MODEL`) | the agent plans tool calls and writes the message | the regex router and prose templates |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | the same agent on an OpenAI-compatible endpoint | as above |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | accounts, login, server-side workspaces, daily run limits | workspace data in this browser |
| `SUPABASE_SERVICE_ROLE_KEY` | a Qloo response cache that survives restarts | an in-memory cache per run |

### Supabase

1. Create a project and apply `supabase/migrations/0001_init.sql` (SQL editor, or `supabase db push`).
2. Under Auth, enable email links and, if you want it, Google. Add `<site>/auth/callback` to the redirect URLs.
3. Set the three Supabase keys. The first login creates a workspace; an invited email joins the inviting workspace instead.

`npm run test:rls` proves the row-level security on a throwaway local Postgres (needs `initdb`, `pg_ctl` and `psql`).

### Checks

```bash
npm run typecheck
npm test                         # scorers, tools, router, agent loop, parsers
npx next build
node --env-file=.env.local scripts/probe-qloo.ts   # live Qloo probe; raw responses go to fixtures/real/ (gitignored)
node scripts/build-demo-seed.ts  # rebuilds the demo chats a fresh browser starts with
```

## Deploy

- **Vercel:** import the repo, set the env vars, and set `NEXT_PUBLIC_SITE_URL` to the production URL. Add the production and preview domains to Supabase Auth's redirect URLs.
- **A server of your own:** `npm ci && npx next build`, copy the folder to `/opt/swami`, then use `deploy/swami.service` and `deploy/nginx.conf`. The nginx file turns buffering off for `/api/chat`, which streams.

The rate limit is per server process; behind several processes each counts its own.

## How an answer is made

```
ChatView ── POST /api/chat (SSE) ──▶ agent/run.ts ──▶ model (plans tools, writes prose)   or   agent/router.ts (regexes)
   ▲  step · text · artifact ·             │ zod-checked tool calls
   │  choices · done                        ▼
   │                                   tools/tools.ts ──▶ score/*.ts (pure, unit-tested)
   │                                        │
   │                                        ▼
   │                                   qloo/client.ts ──▶ memory cache ─▶ qloo_cache ─▶ Qloo API
   │
store.ts ── /api/bootstrap, /api/sync ──▶ db/repo.ts (Supabase as the user, row-level security)
```

- **The model never writes a number.** Tools return typed facts, artifacts are built in code from tool output, and any number in the message text must appear in a tool result or the user's words, or the message falls back to the template.
- **Ambiguous names are asked about.** When a search returns two close matches, the reply carries candidate cards and no tools run until one is picked.
- **Every part has a fallback:** no model means templates, no Qloo key means the fake graph, a failed tool shows as a failed step while the rest of the answer still returns.
- Opener score is `fit^0.6 · reachGain^0.4`. Fit mixes an act's affinity with its lift over a seedless baseline; reach gain is how much of the act's crowd lives where the headliner is weak (`max(0, opener − 0.9 · headliner)` per neighbourhood).

## Layout

- `src/lib/qloo/` Qloo client, fixture source, call budget.
- `src/lib/score/` pure scorers and the city table.
- `src/lib/tools/` the ten tools and their schemas.
- `src/lib/agent/` router, prose, agent loop, events, artifact schema.
- `src/lib/db/` Supabase clients, sync operations, row mapping, usage limits.
- `src/components/app/` the app; `src/components/landing/` the landing page.
- `src/lib/site.ts` holds the product name and shared copy.

## Data honesty

Everything in `fixtures/fake/` is invented: artists, venues, brands and numbers. The app says "Demo data" while it runs on them. Raw Qloo responses never enter git. Pricing is a placeholder.
