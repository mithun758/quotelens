import { NextResponse, type NextRequest } from "next/server";
import { PASSCODE_COOKIE, PASSCODE_COOKIE_MAX_AGE, SESSION_COOKIE, isValidSessionToken } from "@/lib/auth/passcode";

// Optimistic check on every request. The (app) layout checks again on the
// server, so a proxy bypass alone never exposes a page.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(PASSCODE_COOKIE)?.value;
  if (isValidSessionToken(token)) {
    const res = NextResponse.next();
    if (!request.cookies.get(SESSION_COOKIE)) {
      res.cookies.set(SESSION_COOKIE, crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: PASSCODE_COOKIE_MAX_AGE });
    }
    return res;
  }

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Passcode required" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const next = pathname + search;
  if (next !== "/") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
