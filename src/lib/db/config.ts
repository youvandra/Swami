// Public Supabase settings. Both are safe in the browser; without them the app keeps workspace data locally.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const accountsOn = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
/** Show "Continue with Google" only once the Google provider is switched on in Supabase Auth. */
export const googleOn = accountsOn && process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
