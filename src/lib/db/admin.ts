import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PersistentCache } from "../qloo/client.ts";
import { env } from "../env.ts";

// Service-role access, for the two things no user owns: the Qloo cache and nothing else.
let admin: SupabaseClient | null | undefined;
function adminClient(): SupabaseClient | null {
  if (admin === undefined) admin = env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;
  return admin;
}

/** Qloo responses kept server-side across restarts (7 days for insights, 30 for search and tags). */
export function qlooCache(): PersistentCache | undefined {
  const sb = adminClient();
  if (!sb) return undefined;
  return {
    async get(key) {
      const { data } = await sb.from("qloo_cache").select("body, expires_at").eq("key", key).maybeSingle();
      return data && Date.parse(data.expires_at) > Date.now() ? data.body : undefined;
    },
    async set(key, body, ttlDays) {
      await sb.from("qloo_cache").upsert({ key, body, fetched_at: new Date().toISOString(), expires_at: new Date(Date.now() + ttlDays * 86_400_000).toISOString() });
    },
  };
}
