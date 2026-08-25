import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Only run the session-refresh round-trip on real page navigations.
   *
   * Previously this matched everything except static assets, so every /api/*
   * call and every RSC prefetch paid an extra auth.getUser() round-trip on top
   * of the auth check the route handler already does for itself.
   */
  matcher: [
    "/((?!api/|_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)"
  ]
};
