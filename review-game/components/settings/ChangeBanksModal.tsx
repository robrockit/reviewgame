'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import BankSelector from '@/components/onboarding/BankSelector';
import type { PrebuiltBank } from '@/types/question-banks';

interface ChangeBanksModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBankIds: string[];
  onSuccess: () => void;
}

export default function ChangeBanksModal({
  isOpen,
  onClose,
  currentBankIds,
  onSuccess,
}: ChangeBanksModalProps) {
  const [banks, setBanks] = useState<PrebuiltBank[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch banks when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchBanks = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const response = await fetch('/api/question-banks/prebuilt');
        const json = await response.json() as { data?: PrebuiltBank[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? 'Failed to load banks');
        }
        setBanks(json.data ?? []);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load banks');
      } finally {
        setLoading(false);
      }
    };

    void fetchBanks();
  }, [isOpen]);

  const handleConfirm = async (bankIds: string[]) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/users/me/banks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankIds }),
      });

      if (!response.ok) {
        const json = await response.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to update bank selection');
      }

      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={handleClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 mb-2">
                  Change Question Banks
                </Dialog.Title>

                {/* Warning banner */}
                <div className="mb-6 flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-amber-800">
                    Changing banks won&apos;t affect existing games.
                  </p>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-gray-500">Loading available banks...</div>
                  </div>
                ) : fetchError ? (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-800">{fetchError}</p>
                  </div>
                ) : (
                  <BankSelector
                    banks={banks}
                    initialSelection={currentBankIds}
                    onConfirm={handleConfirm}
                    isSubmitting={isSubmitting}
                    submitLabel="Save Changes"
                  />
                )}

                {!loading && !fetchError && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
