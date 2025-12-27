import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ الطريقة الصحيحة
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && pathname.startsWith("/dev")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dev/:path*"],
};
