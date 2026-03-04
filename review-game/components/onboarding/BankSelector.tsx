'use client';

import { useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import type { PrebuiltBank } from '@/types/question-banks';

// Re-export for consumers who import from this module
export type { PrebuiltBank };

interface BankSelectorProps {
  banks: PrebuiltBank[];
  initialSelection?: string[];
  onConfirm: (bankIds: string[]) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

function getDifficultyColor(difficulty: string | null): string {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'hard':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function BankSelector({
  banks,
  initialSelection = [],
  onConfirm,
  isSubmitting = false,
  submitLabel = 'Continue',
}: BankSelectorProps) {
  // useState captures initialSelection only at mount. ChangeBanksModal unmounts
  // this component when the modal closes, so the selection correctly resets on
  // each open. If this component is ever kept mounted across opens, add a
  // `key={currentBankIds.join(',')}` prop at the call site to force remount.
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection);
  const [error, setError] = useState<string | null>(null);

  const toggleBank = (bankId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(bankId)) {
        return prev.filter((id) => id !== bankId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, bankId];
    });
  };

  const handleConfirm = async () => {
    if (selectedIds.length !== 3 || isSubmitting) return;
    setError(null);
    try {
      await onConfirm(selectedIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banks.map((bank) => {
          const isSelected = selectedIds.includes(bank.id);
          const isAtMax = selectedIds.length >= 3;
          const isDisabled = isAtMax && !isSelected;

          return (
            <div
              key={bank.id}
              role="checkbox"
              aria-checked={isSelected}
              aria-disabled={isDisabled}
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => !isDisabled && toggleBank(bank.id)}
              onKeyDown={(e) => {
                if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggleBank(bank.id);
                }
              }}
              className={[
                'relative rounded-lg border-2 p-5 cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                isSelected
                  ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm',
                isDisabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <span className="absolute top-3 right-3">
                  <CheckCircleIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                </span>
              )}

              <h3 className="text-base font-semibold text-gray-900 pr-8">{bank.title}</h3>

              {bank.subject && (
                <p className="mt-1 text-sm text-gray-600">{bank.subject}</p>
              )}

              {bank.description && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-2">{bank.description}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {bank.difficulty && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(bank.difficulty)}`}
                  >
                    {bank.difficulty.charAt(0).toUpperCase() + bank.difficulty.slice(1)}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {bank.question_count} {bank.question_count === 1 ? 'question' : 'questions'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {selectedIds.length}/3 banks selected
        </p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedIds.length !== 3 || isSubmitting}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
