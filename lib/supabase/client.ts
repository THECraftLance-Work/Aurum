"use client";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function createSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: { maxAge: SESSION_COOKIE_MAX_AGE } }
    );
  }
  return browserClient;
}
