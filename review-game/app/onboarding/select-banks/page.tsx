import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import SelectBanksClient from './SelectBanksClient';

export default async function SelectBanksPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Guard: only FREE users who haven't yet selected banks should be here
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, accessible_prebuilt_bank_ids')
    .eq('id', user.id)
    .single();

  const isFree = profile?.subscription_tier?.toUpperCase() === 'FREE';
  const ids = profile?.accessible_prebuilt_bank_ids;
  const alreadyOnboarded = Array.isArray(ids) && ids.length >= 3;

  if (!profile || !isFree || alreadyOnboarded) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Choose 3 subjects to get started!
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Select exactly 3 prebuilt question banks to use in your review games.
            You can change these later in your account settings.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <SelectBanksClient />
        </div>
      </div>
    </div>
  );
}
