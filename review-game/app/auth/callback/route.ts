import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.error('Error exchanging code for session', error, {
        operation: 'exchangeCodeForSession',
        route: '/auth/callback',
        hasCode: !!code, // Log presence, not value
      });
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }

    // Check if new FREE user needs to select banks
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, accessible_prebuilt_bank_ids')
        .eq('id', user.id)
        .single();

      // If profile is null (trigger not yet fired), fall through to next/dashboard
      if (profile) {
        const ids = profile.accessible_prebuilt_bank_ids;
        const needsOnboarding =
          profile.subscription_tier?.toUpperCase() === 'FREE' &&
          (!Array.isArray(ids) || ids.length < 3);

        if (needsOnboarding) {
          return NextResponse.redirect(`${requestUrl.origin}/onboarding/select-banks`);
        }
      }
    }

    // Preserve any next-param encoded in the callback URL (e.g. magic-link logins)
    const next = requestUrl.searchParams.get('next') ?? '/dashboard';
    return NextResponse.redirect(`${requestUrl.origin}${next}`);
  }

  // No code — fall back to dashboard
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
}