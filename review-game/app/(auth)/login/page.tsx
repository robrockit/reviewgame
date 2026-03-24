import LoginForm from '@/components/auth/LoginForm';

/**
 * Login page component
 *
 * Handles the login page display and checks for suspended account redirects.
 * When a user is suspended, the middleware redirects them here with ?suspended=true
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;
  const isSuspended = params.suspended === 'true';

  // Validate redirectTo is a safe root-relative path (same rule as auth/callback).
  // Rejects scheme-relative URLs like //evil.com that would redirect off-site.
  // Next.js decodes percent-encoding in searchParams before this code runs, so
  // %2Fdashboard becomes /dashboard and the startsWith check works correctly.
  // Do NOT add a manual decodeURIComponent here — it would enable a double-decode
  // bypass (%252F → %2F → /) that could defeat the open-redirect guard.
  const raw = params.redirectTo ?? '';
  const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <LoginForm isSuspended={isSuspended} redirectTo={redirectTo} />
    </div>
  );
}