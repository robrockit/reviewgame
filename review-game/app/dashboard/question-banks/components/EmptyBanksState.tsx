'use client';

import { BookOpenIcon } from '@heroicons/react/24/outline';

interface EmptyBanksStateProps {
  canCreate: boolean;
  onCreateClick: () => void;
}

export default function EmptyBanksState({ canCreate, onCreateClick }: EmptyBanksStateProps) {
  return (
    <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
      <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">No question banks</h3>
      <p className="mt-1 text-sm text-gray-500">
        {canCreate
          ? 'Get started by creating your first custom question bank.'
          : 'Browse public question banks or upgrade to create your own.'}
      </p>
      <div className="mt-6">
        {canCreate ? (
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Question Bank
          </button>
        ) : (
          <a
            href="/pricing"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Pricing
          </a>
        )}
      </div>
    </div>
  );
}
