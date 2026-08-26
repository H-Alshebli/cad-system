import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.nextUrl.hostname === "lazemhcad.vercel.app") {
    const destination = request.nextUrl.clone();
    destination.protocol = "https:";
    destination.hostname = "hcad.lazem.sa";
    destination.port = "";

    return NextResponse.redirect(destination, 308);
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && pathname.startsWith("/dev")) {
    return NextResponse.redirect(new URL("/dashboards", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
