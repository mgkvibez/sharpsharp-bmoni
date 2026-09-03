import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * SharpSharp middleware — adds baseline security headers to every response.
 * (In a production deployment this is also where session-cookie route
 * protection would live, per the app's auth conventions.)
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
