import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

const PUBLIC_PAGE_PREFIXES = ["/login", "/setup-password", "/invite"];
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/setup-password",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/invite/accept",
];

function isPublicPath(pathname: string): boolean {
  if (
    PUBLIC_PAGE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return true;
  }
  if (
    PUBLIC_API_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let session = null;
  try {
    session = await getSessionFromRequest(request);
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Server misconfiguration: SESSION_SECRET missing or invalid.",
        },
        { status: 500 },
      );
    }
    return new NextResponse(
      "Server misconfiguration: SESSION_SECRET must be set (32+ characters).",
      { status: 500 },
    );
  }

  if (isPublicPath(pathname)) {
    if (session && pathname === "/login") {
      if (session.mustChangePassword) {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.accountStatus === "SUSPENDED") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.mustChangePassword && pathname !== "/change-password") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Password change required" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (pathname === "/change-password" && !session.mustChangePassword) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    session.role !== "SUPER_ADMIN"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
