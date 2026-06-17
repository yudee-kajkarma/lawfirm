import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';

import authConfig from './auth.config';

const { auth } = NextAuth(authConfig);

/**
 * Edge middleware.
 * - Unauthed user → `/login?callbackUrl=…` for protected paths
 * - Authed user hitting `/login` → bounce to `/dashboard`
 * - Non-admin user hitting `/settings/*` → bounce to `/dashboard`
 *
 * No DB hits here — all checks read from the JWT cookie. API routes do their
 * own auth via `withAuth`, so the matcher below excludes `/api`.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;
  const kind = req.auth?.user?.kind;
  const isOperator = kind === 'operator';
  const isAdmin = req.auth?.user?.isAdmin === true;

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/suspended';

  // A signature-valid JWT from before MT-1 has no `tenantId`. Without this
  // guard the dashboard layout would redirect to /login, the middleware would
  // see the still-valid cookie and bounce back to /dashboard → ERR_TOO_MANY_REDIRECTS.
  // Clear the cookie at the edge so the next request is genuinely unauthed.
  const isStaleTenantUser = isAuthed && kind === 'tenant_user' && !req.auth?.user?.tenantId;
  if (isStaleTenantUser) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    // Auth.js v5 uses `__Secure-` prefix on HTTPS, no prefix on HTTP. Delete both.
    res.cookies.delete('authjs.session-token');
    res.cookies.delete('__Secure-authjs.session-token');
    return res;
  }

  if (!isAuthed && !isPublic) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Authed users have no business on the auth pages.
  if (isAuthed && (pathname === '/login' || pathname === '/signup')) {
    const home = isOperator ? '/admin/tenants' : '/dashboard';
    return NextResponse.redirect(new URL(home, req.url));
  }

  // Operators may ONLY use /admin/*. Anywhere else → /admin/tenants.
  if (isOperator && !pathname.startsWith('/admin') && !isPublic) {
    return NextResponse.redirect(new URL('/admin/tenants', req.url));
  }

  // /admin/* requires an operator. Tenant users get bounced to the dashboard.
  if (pathname.startsWith('/admin') && !isOperator) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Tenant-admin-only settings gated by isAdmin (existing rule).
  if (isAuthed && pathname.startsWith('/settings') && !isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Match everything except API routes, Next internals, and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
