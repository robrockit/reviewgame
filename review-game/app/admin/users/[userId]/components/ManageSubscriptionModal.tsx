/**
 * @fileoverview Modal component for managing user subscriptions.
 *
 * Provides a form to modify subscriptions with action selection, reason input, and confirmation.
 * Supports: Cancel, Reactivate, Change Billing Cycle, Extend Period
 *
 * @module app/admin/users/[userId]/components/ManageSubscriptionModal
 */

'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ManageSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
  subscriptionId: string | null;
  currentStatus: string | null;
  currentBillingCycle: string | null;
  onSuccess: () => void;
}

/**
 * Subscription action types
 */
export type SubscriptionAction =
  | 'cancel_immediate'
  | 'cancel_period_end'
  | 'reactivate'
  | 'change_to_monthly'
  | 'change_to_yearly'
  | 'extend_period';

/**
 * Action configuration with labels and descriptions
 */
const SUBSCRIPTION_ACTIONS: Array<{
  value: SubscriptionAction;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  destructive: boolean;
}> = [
  {
    value: 'cancel_period_end',
    label: 'Cancel at Period End',
    description: 'User retains access until current period ends, then subscription cancels',
    requiresConfirmation: true,
    destructive: true,
  },
  {
    value: 'cancel_immediate',
    label: 'Cancel Immediately',
    description: 'User loses access immediately and subscription ends now',
    requiresConfirmation: true,
    destructive: true,
  },
  {
    value: 'reactivate',
    label: 'Reactivate Subscription',
    description: 'Remove scheduled cancellation and restore ongoing billing',
    requiresConfirmation: false,
    destructive: false,
  },
  {
    value: 'change_to_monthly',
    label: 'Change to Monthly Billing',
    description: 'Switch from yearly to monthly billing cycle',
    requiresConfirmation: false,
    destructive: false,
  },
  {
    value: 'change_to_yearly',
    label: 'Change to Yearly Billing',
    description: 'Switch from monthly to yearly billing cycle',
    requiresConfirmation: false,
    destructive: false,
  },
  {
    value: 'extend_period',
    label: 'Extend Current Period',
    description: 'Add additional days to the current billing period',
    requiresConfirmation: false,
    destructive: false,
  },
];

/**
 * Manage subscription modal component
 *
 * Displays a modal dialog with action selection, configuration, and confirmation.
 * Follows the established two-step pattern for destructive actions.
 */
export default function ManageSubscriptionModal({
  isOpen,
  onClose,
  userEmail,
  userId,
  subscriptionId,
  currentStatus,
  currentBillingCycle,
  onSuccess,
}: ManageSubscriptionModalProps) {
  const [action, setAction] = useState<SubscriptionAction>('cancel_period_end');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [extendDays, setExtendDays] = useState(30);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  /**
   * Get available actions based on current subscription state
   */
  const getAvailableActions = (): SubscriptionAction[] => {
    const actions: SubscriptionAction[] = [];

    // Can cancel if active or trialing
    if (currentStatus === 'active' || currentStatus === 'trialing') {
      actions.push('cancel_immediate', 'cancel_period_end');
    }

    // Can reactivate if canceled but not yet ended
    if (currentStatus === 'canceled') {
      actions.push('reactivate');
    }

    // Can change billing cycle if active
    if (currentStatus === 'active') {
      if (currentBillingCycle !== 'monthly') {
        actions.push('change_to_monthly');
      }
      if (currentBillingCycle !== 'yearly') {
        actions.push('change_to_yearly');
      }
      actions.push('extend_period');
    }

    return actions;
  };

  const availableActions = getAvailableActions();
  const selectedActionConfig = SUBSCRIPTION_ACTIONS.find(a => a.value === action);

  /**
   * Validates the form can be submitted
   */
  const canSubmit = (): boolean => {
    if (reason.trim().length < 10) return false;
    if (action === 'extend_period' && (extendDays < 1 || extendDays > 365)) return false;
    return true;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (hasSubmitted || isSubmitting) {
      return;
    }

    // Show confirmation if required and not already shown
    if (selectedActionConfig?.requiresConfirmation && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    setHasSubmitted(true);
    setSubmitError(null);

    try {
      const endpoint = action.startsWith('cancel')
        ? `/api/admin/users/${userId}/subscription/cancel`
        : action === 'reactivate'
        ? `/api/admin/users/${userId}/subscription/reactivate`
        : action === 'extend_period'
        ? `/api/admin/users/${userId}/subscription/extend`
        : `/api/admin/users/${userId}/subscription/update`;

      const body: Record<string, unknown> = {
        action,
        reason,
        notes: notes || undefined,
      };

      // Add action-specific parameters
      if (action === 'extend_period') {
        body.extendDays = extendDays;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to manage subscription');
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
      setShowConfirmation(false);
      setHasSubmitted(false); // Allow retry on error
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles modal close
   */
  const handleClose = () => {
    if (!isSubmitting) {
      setShowConfirmation(false);
      setAction('cancel_period_end');
      setReason('');
      setNotes('');
      setExtendDays(30);
      setSubmitError(null);
      setHasSubmitted(false);
      onClose();
    }
  };

  /**
   * Handles going back from confirmation
   */
  const handleBack = () => {
    setShowConfirmation(false);
    setSubmitError(null);
  };

  // Don't show modal if no subscription
  if (!subscriptionId) {
    return null;
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        {/* Backdrop */}
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

        {/* Modal container */}
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {showConfirmation ? 'Confirm Action' : 'Manage Subscription'}
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Error message */}
                {submitError && (
                  <div className="mb-4 rounded-lg bg-red-50 p-4">
                    <div className="flex">
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          Error managing subscription
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>{submitError}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showConfirmation ? (
                  /* Confirmation Screen */
                  <div className="space-y-4">
                    <div className={`rounded-lg border p-4 ${
                      selectedActionConfig?.destructive
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className="flex">
                        <ExclamationTriangleIcon className={`h-6 w-6 flex-shrink-0 ${
                          selectedActionConfig?.destructive ? 'text-red-600' : 'text-amber-600'
                        }`} />
                        <div className="ml-3">
                          <h4 className={`text-sm font-medium mb-2 ${
                            selectedActionConfig?.destructive ? 'text-red-800' : 'text-amber-800'
                          }`}>
                            Are you sure you want to {selectedActionConfig?.label.toLowerCase()}?
                          </h4>
                          <p className={`text-sm mb-2 ${
                            selectedActionConfig?.destructive ? 'text-red-700' : 'text-amber-700'
                          }`}>
                            <strong>{userEmail}</strong> - {selectedActionConfig?.description}
                          </p>
                          <div className={`mt-3 border-t pt-3 ${
                            selectedActionConfig?.destructive ? 'border-red-200' : 'border-amber-200'
                          }`}>
                            <p className={`text-sm font-medium ${
                              selectedActionConfig?.destructive ? 'text-red-800' : 'text-amber-800'
                            }`}>Action:</p>
                            <p className={`text-sm ${
                              selectedActionConfig?.destructive ? 'text-red-700' : 'text-amber-700'
                            }`}>
                              {selectedActionConfig?.label}
                            </p>
                            <p className={`text-sm font-medium mt-2 ${
                              selectedActionConfig?.destructive ? 'text-red-800' : 'text-amber-800'
                            }`}>Reason:</p>
                            <p className={`text-sm whitespace-pre-wrap ${
                              selectedActionConfig?.destructive ? 'text-red-700' : 'text-amber-700'
                            }`}>
                              {reason}
                            </p>
                            {notes && (
                              <>
                                <p className={`text-sm font-medium mt-2 ${
                                  selectedActionConfig?.destructive ? 'text-red-800' : 'text-amber-800'
                                }`}>Notes:</p>
                                <p className={`text-sm whitespace-pre-wrap ${
                                  selectedActionConfig?.destructive ? 'text-red-700' : 'text-amber-700'
                                }`}>
                                  {notes}
                                </p>
                              </>
                            )}
                            {action === 'extend_period' && (
                              <>
                                <p className={`text-sm font-medium mt-2 ${
                                  selectedActionConfig?.destructive ? 'text-red-800' : 'text-amber-800'
                                }`}>Extension:</p>
                                <p className={`text-sm ${
                                  selectedActionConfig?.destructive ? 'text-red-700' : 'text-amber-700'
                                }`}>
                                  {extendDays} days
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          selectedActionConfig?.destructive
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                        }`}
                      >
                        {isSubmitting ? 'Processing...' : 'Yes, Proceed'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form Screen */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Managing subscription for <strong>{userEmail}</strong>
                    </p>

                    {/* Action Selection */}
                    <div>
                      <label
                        htmlFor="action"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Action <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="action"
                        name="action"
                        value={action}
                        onChange={(e) => setAction(e.target.value as SubscriptionAction)}
                        disabled={isSubmitting}
                        required
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {SUBSCRIPTION_ACTIONS
                          .filter(option => availableActions.includes(option.value))
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {selectedActionConfig?.description}
                      </p>
                    </div>

                    {/* Extend Days (only for extend_period action) */}
                    {action === 'extend_period' && (
                      <div>
                        <label
                          htmlFor="extendDays"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Days to Extend <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          id="extendDays"
                          name="extendDays"
                          value={extendDays}
                          onChange={(e) => setExtendDays(parseInt(e.target.value))}
                          disabled={isSubmitting}
                          required
                          min="1"
                          max="365"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Enter number of days (1-365) to add to the current period
                        </p>
                      </div>
                    )}

                    {/* Reason */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="reason"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Reason <span className="text-red-500">*</span>
                        </label>
                        <span className="text-xs text-gray-500">
                          {reason.length}/500
                        </span>
                      </div>
                      <textarea
                        id="reason"
                        name="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={isSubmitting}
                        required
                        minLength={10}
                        maxLength={500}
                        rows={3}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Explain why you're making this change (minimum 10 characters)..."
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Required for audit and compliance purposes
                      </p>
                    </div>

                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="notes"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Additional Notes (Optional)
                        </label>
                        <span className="text-xs text-gray-500">
                          {notes.length}/1000
                        </span>
                      </div>
                      <textarea
                        id="notes"
                        name="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isSubmitting}
                        maxLength={1000}
                        rows={3}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Add any additional context or details..."
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !canSubmit()}
                        className="inline-flex justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selectedActionConfig?.requiresConfirmation ? 'Continue' : 'Submit'}
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
