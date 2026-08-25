import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — server-only, never import
 * into a "use client" module.
 *
 * Deliberately separate from lib/supabase/server.ts: that file imports
 * `next/headers` and wraps its exports in React's `cache()`, neither of which
 * the admin client needs (it never touches cookies). Keeping it here means the
 * outbound/integration code has no Next.js or React dependency at all.
 *
 * Not memoized: React `cache()` only dedupes within a render pass, and this is
 * called almost exclusively from route handlers, where it would buy nothing.
 * Constructing the client is cheap — it opens no connection.
 */
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
