import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // نحدد البيئة
  const env = process.env.NEXT_PUBLIC_ENV;

  // إذا Production ونحاول دخول /dev/*
  if (env === "production" && pathname.startsWith("/dev")) {
    // إعادة توجيه للداشبورد
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// تحديد المسارات التي يعمل عليها الـ middleware
export const config = {
  matcher: ["/dev/:path*"],
};
