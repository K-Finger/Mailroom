import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/billing", "/api/jobs", "/api/upload", "/api/google-drive", "/api/stripe/checkout", "/api/stripe/portal"];
const authRoutes = ["/login", "/signup"];

/** Supabase stores the session in sb-<project-ref>-auth-token (may be chunked as .0, .1, ...) */
function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    ({ name }) => name.startsWith("sb-") && name.includes("-auth-token"),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const loggedIn = hasSupabaseSession(request);
  const isProtectedRoute = protectedRoutes.some((r) => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));

  if (isProtectedRoute && !loggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && loggedIn) {
    return NextResponse.redirect(new URL("/pipeline", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
