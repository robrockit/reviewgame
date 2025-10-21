import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.delete({ name, ...options });
        },
      },
    }
  );

  await supabase.auth.getSession();

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths you want to protect, including those
     * starting with a root folder (e.g. /dashboard).
     * Exclude static files and API routes.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
};