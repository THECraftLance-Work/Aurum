import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Keep the persistent session across normal day-to-day visits. Supabase still
// refreshes the short-lived access token; this only controls the browser cookie
// lifetime and does not create an unlimited session.
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Request-scoped Supabase client bound to the caller's cookies.
 *
 * `cache()` memoizes this for the duration of a single render pass, so the
 * layout, the page and any helper all share one client instead of each
 * constructing their own.
 *
 * The service-role client lives in ./admin.ts — deliberately separate, so code
 * that only needs the admin client (the outbound worker, notification helpers)
 * doesn't pull in `next/headers` and can be reused outside Next.js.
 */
export const createSupabaseServer = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: SESSION_COOKIE_MAX_AGE },
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: "", ...options }); } catch {}
        }
      }
    }
  );
});
