"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let client: ReturnType<typeof createBrowserClient> | undefined;
export const supabaseBrowser = () => (client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY));
