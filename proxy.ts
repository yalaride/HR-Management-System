import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canViewFullAuditLogs } from "@/lib/audit-log-access";

// The function must be named 'proxy' or be the default export when using proxy.ts
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const role = token?.role as string | undefined;
  const email = typeof token?.email === "string" ? token.email : "";
  const deskOpen =
    role === "employee" &&
    request.cookies.get("desk_open")?.value === "1" &&
    canViewFullAuditLogs(email);

  // 1. Handle requests to the main page "/"
  if (pathname === "/") {
    if (token) {
      // If already logged in, redirect to their dashboard
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      } else if (role === "employee") {
        return NextResponse.redirect(new URL("/employee/dashboard", request.url));
      }
    }
    // If not logged in, allow them to view the main page
    return NextResponse.next();
  }

  // 2. Protect "/admin" routes
  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (role !== "admin" && !deskOpen) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // 3. Protect "/employee" routes
  if (pathname.startsWith("/employee")) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (role !== "employee") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/employee/:path*"],
};