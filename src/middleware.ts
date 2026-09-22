import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "es", "de"];
const defaultLocale = "en";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the pathname already has a supported locale prefix
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return;

  // Skip files in public folder, next assets, api routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return;
  }

  // Always default to English for root and unlocalized paths
  request.nextUrl.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    // Skip all internal paths (_next) and assets, api, robots.txt, sitemap.xml, etc.
    '/((?!_next|api|assets|data|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};

