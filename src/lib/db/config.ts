// Public Supabase settings. Both are safe in the browser; without them the app keeps workspace data locally.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const accountsOn = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
