import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = process.env.NEXT_PUBLIC_COOKIE_NAME ?? 'saymon_session';
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(COOKIE_NAME);
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skips Next internals, the icon/favicon routes, and any public static
  // asset (by extension) — none of those should ever redirect to /login,
  // otherwise an unauthenticated visitor's browser would try to render the
  // login page's HTML as an image (e.g. the logo on the login page itself).
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
};
