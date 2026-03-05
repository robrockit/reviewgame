'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BankSelector from '@/components/onboarding/BankSelector';
import type { PrebuiltBank } from '@/types/question-banks';

export default function SelectBanksClient() {
  const [banks, setBanks] = useState<PrebuiltBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('/api/question-banks/prebuilt');
        const json = await response.json() as { data?: PrebuiltBank[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? 'Failed to load available banks');
        }
        setBanks(json.data ?? []);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load available banks');
      } finally {
        setLoading(false);
      }
    };

    void fetchBanks();
  }, []);

  const handleConfirm = async (bankIds: string[]) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/onboarding/select-banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankIds }),
      });

      if (!response.ok) {
        const json = await response.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to save bank selection');
      }

      router.push('/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading available banks...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 w-full max-w-md text-center">
          <p className="text-sm text-red-800">{fetchError}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-indigo-600 hover:text-indigo-500 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <BankSelector
      banks={banks}
      onConfirm={handleConfirm}
      isSubmitting={isSubmitting}
      submitLabel="Continue"
    />
  );
}
