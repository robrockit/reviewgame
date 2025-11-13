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
  searchParams: Promise<{ suspended?: string }>;
}) {
  const params = await searchParams;
  const isSuspended = params.suspended === 'true';

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <LoginForm isSuspended={isSuspended} />
    </div>
  );
}