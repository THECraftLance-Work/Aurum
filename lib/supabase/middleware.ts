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
  const path = request.nextUrl.pathname;
  const hasOnboarded = request.cookies.get("srivaraha_onboarded")?.value === "1";
  const hasValidProject = Boolean(request.cookies.get("srivaraha_project")?.value);
  const isProjectPage = path === "/projects" || path.startsWith("/projects/");
  const isApiOrAuth = path.startsWith("/api/") || path === "/login" || path === "/register";
  const isRootOrDashboard = path === "/" || path === "/dashboard" || path.startsWith("/dashboard/");

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

  // Project scoping: per-user assigned project (set by Admin/Director in user panel).
  // If a user has an assigned_project_id, they are auto-redirected to that project
  // on every login without seeing the project picker. Otherwise we fall back to the
  // existing Aurum‑default logic (see below).
  if (user) {
    const { data: profile } = await supabase.from("app_users").select("assigned_project_id").eq("id", user.id).maybeSingle();
    const assignedProjectId = (profile as any)?.assigned_project_id as string | undefined;

    // ── 1️⃣  User has an admin‑assigned project ──────────────────────────────
    if (assignedProjectId && !hasValidProject) {
      const isRoot = path === "/";
      const targetUrl = isRoot ? new URL("/dashboard", request.url) : request.nextUrl.clone();
      const res = isRoot ? NextResponse.redirect(targetUrl) : NextResponse.next({ request });
      res.cookies.set("srivaraha_project", assignedProjectId, { path: "/", maxAge: 315360000 });
      res.cookies.set("srivaraha_onboarded", "1", { path: "/", maxAge: 315360000 });
      return res;
    }

    // ── 2️⃣  No assigned project → onboarding / direct to dashboard ──────────
    if (!hasValidProject && !isProjectPage && !isApiOrAuth && isRootOrDashboard) {
      const { data: profile } = await supabase.from("app_users").select("role").eq("id", user.id).maybeSingle();
      const role = (profile as any)?.role as string | undefined;
      const isPrivileged = role === "ADMIN" || role === "DIRECTOR";

      // If user has already selected a project previously or is privileged (Admin/Director),
      // do not show the select project page on the first page: go straight to dashboard.
      if (hasOnboarded || isPrivileged) {
        if (path === "/") {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
        return NextResponse.next({ request });
      }

      // First time user: direct to select project first
      const url = request.nextUrl.clone();
      url.pathname = "/projects";
      return NextResponse.redirect(url);
    }

    if (path === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

  // Ensure response cookies are available after supabase client initialization
  // by re-applying any set operations through the response object.
  return response;
}
}