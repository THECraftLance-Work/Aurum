import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 10; // per IP per window

// Simple in-memory rate limiter.
// Note: Vercel serverless functions reset process memory between invocations,
// so this only dampens rapid retries within a single warm invocation window.
// For production-grade rate limiting, use a Redis-backed solution.
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(ip: string): { allowed: boolean; reset: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = rateLimiter.get(ip) || [];

  // Remove timestamps outside the current window
  const valid = timestamps.filter((t) => t > windowStart);

  if (valid.length >= MAX_REQUESTS_PER_WINDOW) {
    const reset = valid[valid.length - 1] + RATE_LIMIT_WINDOW_MS;
    return { allowed: false, reset };
  }

  // Record this request
  valid.push(now);
  rateLimiter.set(ip, valid);

  return { allowed: true, reset: now + RATE_LIMIT_WINDOW_MS };
}

function setAuthCookie(response: NextRequest, name: string, value: string, options: CookieOptions) {
  const cookieHeader = `${name}=${value}; Path=/; Max-Age=${options.maxAge ?? 604800}; HttpOnly=${options.httpOnly ?? true}`;
  response.headers.set("Set-Cookie", cookieHeader);
}

export async function updateSession(request: NextRequest) {
  // Fast path: without an auth cookie there is no session to refresh, so skip
  // the auth.getUser() network round-trip entirely (login/register/cold hits).
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuthCookie) {
    // Rate-unauthenticated paths: apply lightweight IP limiter only
    // Extract IP from x-forwarded-for or fall back to unknown
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name);
          return cookie?.value;
        },
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  // First-login project picker: if authenticated and no project selected, force SRIVARAHA/Projects
  if (user) {
    const hasProject = request.cookies.has("srivaraha_project");
    const path = request.nextUrl.pathname;
    const isProjectPage = path.startsWith("/srivaraha") || path === "/projects" || path.startsWith("/projects/");
    const isApiOrAuth = path.startsWith("/api") || path.startsWith("/auth") || path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/pending");
    if (!hasProject && !isProjectPage && !isApiOrAuth && (path === "/" || path === "/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/srivaraha/projects";
      return NextResponse.redirect(url);
    }
  }

  // Ensure response cookies are available after supabase client initialization
  // by re-applying any set operations through the response object.
  return response;
}