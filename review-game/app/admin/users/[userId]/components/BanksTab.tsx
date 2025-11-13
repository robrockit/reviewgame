/**
 * @fileoverview Banks tab component displaying user's question banks.
 *
 * Fetches and displays a list of question banks created by the user.
 *
 * @module app/admin/users/[userId]/components/BanksTab
 */

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { AdminUserQuestionBank } from '@/app/api/admin/users/[userId]/banks/route';

interface BanksTabProps {
  userId: string;
}

/**
 * Response type for question banks API
 */
interface BanksResponse {
  data: AdminUserQuestionBank[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Banks tab component
 *
 * Displays a list of question banks created by the user with details:
 * - Bank title and subject
 * - Description
 * - Difficulty level
 * - Number of questions
 * - Public/private status
 * - Creation date
 */
export default function BanksTab({ userId }: BanksTabProps) {
  const [banksData, setBanksData] = useState<BanksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBanks() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/users/${userId}/banks`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch question banks');
        }

        const data = await response.json();
        setBanksData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchBanks();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-sm text-gray-600">Loading question banks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading question banks</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!banksData || banksData.data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-sm text-gray-500">No question banks created yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Question Banks ({banksData.pagination.totalCount})
        </h3>
      </div>

      <div className="space-y-4">
        {banksData.data.map((bank) => (
          <div
            key={bank.id}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="text-base font-medium text-gray-900">
                    {bank.title}
                  </h4>
                  {bank.is_public && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      Public
                    </span>
                  )}
                  {bank.is_custom && (
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                      Custom
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                  <span className="font-medium text-purple-600">{bank.subject}</span>
                  {bank.difficulty && (
                    <span>
                      Difficulty:{' '}
                      <span className="font-medium">
                        {bank.difficulty.charAt(0).toUpperCase() + bank.difficulty.slice(1)}
                      </span>
                    </span>
                  )}
                  <span>
                    <span className="font-medium">{bank.question_count || 0}</span> questions
                  </span>
                </div>

                {bank.description && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {bank.description}
                  </p>
                )}

                <div className="mt-2 text-xs text-gray-400">
                  Created {bank.created_at
                    ? format(new Date(bank.created_at), 'MMM d, yyyy')
                    : 'Unknown'}
                  {bank.updated_at && bank.updated_at !== bank.created_at && (
                    <span>
                      {' • Updated '}
                      {format(new Date(bank.updated_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
