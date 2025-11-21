/**
 * @fileoverview Payment history table component showing transactions from Stripe
 *
 * Displays payment history with pagination
 *
 * @module app/admin/users/[userId]/components/PaymentHistoryTable
 */

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { PaymentHistoryResponse, PaymentRecord } from '@/app/api/admin/users/[userId]/payments/route';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface PaymentHistoryTableProps {
  userId: string;
}

/**
 * Payment history table component
 *
 * Fetches and displays payment history from Stripe
 */
export default function PaymentHistoryTable({ userId }: PaymentHistoryTableProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/users/${userId}/payments?limit=50`);

        if (!response.ok) {
          throw new Error('Failed to fetch payment history');
        }

        const result: PaymentHistoryResponse = await response.json();
        setPayments(result.payments);
        setHasMore(result.hasMore);
        setError(result.error || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payment history');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-sm text-gray-600">Loading payment history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-6">
        <p className="text-sm text-gray-600 text-center">No payment history found for this user</p>
      </div>
    );
  }

  // Helper to get status badge styling
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      succeeded: { bg: 'bg-green-100', text: 'text-green-800' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      failed: { bg: 'bg-red-100', text: 'text-red-800' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Helper to format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(payment.created), 'MMM d, yyyy')}
                    <div className="text-xs text-gray-500">
                      {format(new Date(payment.created), 'h:mm a')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="font-medium">{formatCurrency(payment.amount, payment.currency)}</div>
                    {payment.refunded && (
                      <div className="text-xs text-red-600">
                        Refunded: {formatCurrency(payment.refundedAmount, payment.currency)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate">
                      {payment.description || '-'}
                    </div>
                    {payment.invoiceId && (
                      <div className="text-xs text-gray-500 font-mono">
                        Invoice: {payment.invoiceId.substring(0, 20)}...
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      payment.type === 'charge' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {payment.type.charAt(0).toUpperCase() + payment.type.slice(1)}
                    </span>
                    {payment.refunded && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                        Refunded
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {payment.receiptUrl ? (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-900 inline-flex items-center"
                      >
                        View
                        <ArrowTopRightOnSquareIcon className="ml-1 h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Showing first {payments.length} payments. Pagination coming soon.
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center">
        <p>Payment history is fetched in real-time from Stripe</p>
      </div>
    </div>
  );
}
