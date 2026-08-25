import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

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
export const createSupabaseServer = cache(() => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
