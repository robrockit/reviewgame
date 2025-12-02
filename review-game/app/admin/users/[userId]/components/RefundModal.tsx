/**
 * @fileoverview Modal component for processing payment refunds
 *
 * Allows admins to issue full or partial refunds for payments
 *
 * @module app/admin/users/[userId]/components/RefundModal
 */

'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import type { PaymentRecord } from '@/app/api/admin/users/[userId]/payments/route';
import type { RefundRequest, RefundResponse, RefundReasonCategory } from '@/app/api/admin/payments/[paymentId]/refund/route';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord;
  onSuccess: (refundId: string, amount: number) => void;
}

/**
 * XSS prevention patterns
 */
const FORBIDDEN_PATTERNS = [
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters (except \t, \n, \r)
  /<script[^>]*>.*?<\/script>/gi, // Script tags
  /javascript:/gi, // JavaScript protocol
  /on\w+\s*=/gi, // Event handlers like onclick=, onload=, etc.
];

function containsForbiddenPatterns(input: string): boolean {
  return FORBIDDEN_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Refund reason categories with user-friendly labels
 */
const REASON_CATEGORIES: { value: RefundReasonCategory; label: string; description: string }[] = [
  { value: 'technical_issue', label: 'Technical Issue', description: 'Service outage or technical problem' },
  { value: 'user_request', label: 'User Request', description: 'Customer requested refund' },
  { value: 'duplicate_charge', label: 'Duplicate Charge', description: 'Customer was charged twice' },
  { value: 'fraudulent', label: 'Fraudulent Transaction', description: 'Suspected or confirmed fraud' },
  { value: 'service_outage', label: 'Service Outage Compensation', description: 'Refund due to service downtime' },
  { value: 'other', label: 'Other', description: 'Other reason not listed above' },
];

/**
 * RefundModal component
 *
 * Displays modal for processing full or partial refunds
 */
export default function RefundModal({ isOpen, onClose, payment, onSuccess }: RefundModalProps) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<RefundReasonCategory>('user_request');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate refundable amount (total - already refunded)
  const refundableAmount = payment.amount - payment.refundedAmount;
  const refundableAmountDisplay = (refundableAmount / 100).toFixed(2);

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setRefundType('full');
    setPartialAmount('');
    setReasonCategory('user_request');
    setNotes('');
    setError(null);
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  /**
   * Validate form inputs
   */
  const validateForm = (): string | null => {
    // Validate partial amount
    if (refundType === 'partial') {
      const amount = parseFloat(partialAmount);
      if (isNaN(amount) || amount <= 0) {
        return 'Please enter a valid refund amount';
      }
      const amountCents = Math.round(amount * 100);
      if (amountCents > refundableAmount) {
        return `Refund amount cannot exceed $${refundableAmountDisplay}`;
      }
      if (amountCents < 50) { // Stripe minimum is $0.50
        return 'Refund amount must be at least $0.50';
      }
    }

    // Validate notes
    if (!notes.trim()) {
      return 'Please provide notes explaining the reason for this refund';
    }

    if (notes.trim().length < 10) {
      return 'Notes must be at least 10 characters long';
    }

    if (notes.trim().length > 1000) {
      return 'Notes must be 1000 characters or less';
    }

    // Check for XSS patterns
    if (containsForbiddenPatterns(notes)) {
      return 'Notes contain invalid characters or patterns. Please remove any HTML tags, scripts, or special characters.';
    }

    return null;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    setError(null);

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare request body
      const requestBody: RefundRequest = {
        refundType,
        reasonCategory,
        notes: notes.trim(),
      };

      // Add amount for partial refunds (convert dollars to cents)
      if (refundType === 'partial') {
        const amountCents = Math.round(parseFloat(partialAmount) * 100);
        requestBody.amount = amountCents;
      }

      // Send refund request to API
      const response = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result: RefundResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to process refund');
      }

      // Success!
      if (result.refund) {
        onSuccess(result.refund.id, result.refund.amount);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format currency for display
  const formatCurrency = (amountCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: payment.currency.toUpperCase(),
    }).format(amountCents / 100);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    Process Refund
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-6">
                  {/* Warning Banner */}
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Refund Confirmation Required</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>This action will immediately process a refund via Stripe and cannot be undone. Please verify all details before proceeding.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Payment Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Payment ID:</span>
                        <span className="ml-2 font-mono text-xs text-gray-900">{payment.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <span className="ml-2 text-gray-900">
                          {new Date(payment.created).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Original Amount:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                      {payment.refundedAmount > 0 && (
                        <div>
                          <span className="text-gray-500">Already Refunded:</span>
                          <span className="ml-2 text-red-600 font-medium">
                            {formatCurrency(payment.refundedAmount)}
                          </span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-gray-500">Refundable Amount:</span>
                        <span className="ml-2 text-green-600 font-semibold">
                          {formatCurrency(refundableAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Refund Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Refund Type <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="refundType"
                          value="full"
                          checked={refundType === 'full'}
                          onChange={() => setRefundType('full')}
                          disabled={isSubmitting}
                          className="mt-0.5 h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">Full Refund</div>
                          <div className="text-sm text-gray-500">
                            Refund entire amount: {formatCurrency(refundableAmount)}
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="refundType"
                          value="partial"
                          checked={refundType === 'partial'}
                          onChange={() => setRefundType('partial')}
                          disabled={isSubmitting}
                          className="mt-0.5 h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">Partial Refund</div>
                          <div className="text-sm text-gray-500 mb-2">
                            Refund a specific amount (maximum: {formatCurrency(refundableAmount)})
                          </div>
                          {refundType === 'partial' && (
                            <div className="relative mt-2">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                              </div>
                              <input
                                type="number"
                                step="0.01"
                                min="0.50"
                                max={(refundableAmount / 100).toString()}
                                value={partialAmount}
                                onChange={(e) => setPartialAmount(e.target.value)}
                                placeholder="0.00"
                                disabled={isSubmitting}
                                className="block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                              />
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm uppercase">{payment.currency}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Reason Category */}
                  <div>
                    <label htmlFor="reasonCategory" className="block text-sm font-medium text-gray-700 mb-2">
                      Reason Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="reasonCategory"
                      value={reasonCategory}
                      onChange={(e) => setReasonCategory(e.target.value as RefundReasonCategory)}
                      disabled={isSubmitting}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    >
                      {REASON_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label} - {category.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Admin Notes */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="notes"
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Provide a detailed explanation for this refund (minimum 10 characters)"
                      disabled={isSubmitting}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {notes.length}/1000 characters
                    </p>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 inline-flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing Refund...
                      </>
                    ) : (
                      `Process ${refundType === 'full' ? 'Full' : 'Partial'} Refund`
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
