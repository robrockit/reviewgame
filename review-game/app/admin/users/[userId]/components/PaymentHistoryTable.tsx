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
import { ArrowTopRightOnSquareIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import RefundModal from './RefundModal';

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
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchPaymentHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/users/${userId}/payments?limit=50`);

        if (!response.ok) {
          throw new Error('Failed to fetch payment history');
        }

        const result: PaymentHistoryResponse = await response.json();

        // Only update state if this effect hasn't been cancelled
        if (!cancelled) {
          setPayments(result.payments);
          setHasMore(result.hasMore);
          setError(result.error || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load payment history');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPaymentHistory();

    // Cleanup function to prevent race conditions
    return () => {
      cancelled = true;
    };
  }, [userId, refreshTrigger]);

  /**
   * Handle opening refund modal
   */
  const handleOpenRefundModal = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsRefundModalOpen(true);
  };

  /**
   * Handle successful refund
   */
  const handleRefundSuccess = (refundId: string, amount: number) => {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedPayment?.currency.toUpperCase() || 'USD',
    }).format(amount / 100);

    setSuccessMessage(`Refund processed successfully! Refund ID: ${refundId} for ${formattedAmount}`);

    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);

    // Refresh payment history
    setRefreshTrigger(prev => prev + 1);
  };

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
      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setSuccessMessage(null)}
                className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {payment.status === 'succeeded' && !payment.refunded && payment.type === 'charge' ? (
                      <button
                        onClick={() => handleOpenRefundModal(payment)}
                        className="inline-flex items-center text-red-600 hover:text-red-900"
                      >
                        <BanknotesIcon className="mr-1 h-4 w-4" />
                        Refund
                      </button>
                    ) : payment.refunded ? (
                      <span className="text-gray-400">Refunded</span>
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

      {/* Refund Modal */}
      {selectedPayment && (
        <RefundModal
          isOpen={isRefundModalOpen}
          onClose={() => setIsRefundModalOpen(false)}
          payment={selectedPayment}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  );
}
