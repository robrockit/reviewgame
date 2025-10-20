import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function middleware(req: NextRequest) {
  const supabase = createClient();

  // Refresh the session so that the user is logged in
  const { data: { session } } = await supabase.auth.getSession();

  // If there's no session, we can proceed without doing anything specific
  // or redirect to login if the route requires authentication.
  // For now, we'll just let the request continue.

  // If you need to protect routes, you would add logic here:
  // if (req.nextUrl.pathname.startsWith('/dashboard') && !session) {
  //   const url = req.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  // For session refresh, the getSession() call itself might be enough
  // if the underlying client handles token refresh automatically.
  // The @supabase/ssr package's createBrowserClient is designed to handle this.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths you want to protect, including those
     * starting with a root folder (e.g. /dashboard).
     * Exclude static files and API routes.
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};