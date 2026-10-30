import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  const isAuthRoute = pathname === '/login' || pathname === '/signup';
  const isProtectedRoute =
    pathname === '/app' ||
    pathname.startsWith('/app/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/');

  // 1. Guard protected app and admin routes against unauthenticated access
  if (isProtectedRoute && (!token || token.trim().length === 0)) {
    const returnUrl = pathname + search;
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect_to', returnUrl);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Redirect authenticated users away from auth forms directly to their workspace or return path
  if (isAuthRoute && token && token.trim().length > 0) {
    const rawRedirect = request.nextUrl.searchParams.get('redirect_to');
    const isValidRedirect =
      rawRedirect &&
      rawRedirect.startsWith('/') &&
      !rawRedirect.startsWith('//') &&
      !rawRedirect.includes('\\');

    const destination = isValidRedirect ? rawRedirect : '/app/quant';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/app',
    '/app/:path*',
    '/admin',
    '/admin/:path*',
    '/login',
    '/signup',
  ],
};

