import "server-only";
import { z } from "zod";

// Server configuration. Every integration is optional: each missing key drops to a working fallback.
const schema = z.object({
  QLOO_API_KEY: z.string().optional(),
  QLOO_BASE_URL: z.string().url().default("https://hackathon.api.qloo.com"),
  ANTHROPIC_API_KEY: z.string().optional(),
  SWAMI_MODEL: z.string().default("claude-sonnet-5-5"),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().default("http://localhost:5192"),
  SWAMI_DAILY_RUNS_PER_WORKSPACE: z.coerce.number().int().positive().default(200),
  // every workspace together: sign-ups are free, so this bounds what one person with many emails can spend
  SWAMI_DAILY_RUNS_GLOBAL: z.coerce.number().int().positive().default(2000),
  // invitation emails a workspace may send a day; each one goes out from the swami.web.id domain
  SWAMI_DAILY_INVITES_PER_WORKSPACE: z.coerce.number().int().positive().default(10),
  // demo only: delay per fake Qloo call, so steps stream visibly
  // local only: lets chat run without a session; ignored when NODE_ENV is production
  SWAMI_DEV_NO_AUTH: z.string().optional(),
  SWAMI_FIXTURE_DELAY_MS: z.coerce.number().int().min(0).max(5000).default(0),
});

// empty strings in .env files mean "unset"
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
const parsed = schema.parse(raw);

export const env = {
  ...parsed,
  qlooLive: !!parsed.QLOO_API_KEY,
  devNoAuth: parsed.SWAMI_DEV_NO_AUTH === "1" && process.env.NODE_ENV !== "production",
  agentMode: (parsed.ANTHROPIC_API_KEY ? "anthropic" : parsed.LLM_BASE_URL && parsed.LLM_API_KEY && parsed.LLM_MODEL ? "compat" : "template") as "anthropic" | "compat" | "template",
  dbMode: (parsed.NEXT_PUBLIC_SUPABASE_URL && parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "supabase" : "local") as "supabase" | "local",
};
