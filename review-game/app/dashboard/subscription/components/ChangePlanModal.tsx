/**
 * ChangePlanModal Component
 *
 * Modal for changing subscription plan (upgrade/downgrade or billing cycle)
 * Fetches plans from server-side API for security
 */

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import type { PlanOption } from '@/types/subscription.types';

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  currentTier: 'FREE' | 'BASIC' | 'PREMIUM';
  currentBillingCycle: 'monthly' | 'annual' | null;
}

export default function ChangePlanModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  currentTier,
  currentBillingCycle,
}: ChangePlanModalProps) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Fetch plans from server when modal opens
  useEffect(() => {
    if (isOpen && plans.length === 0) {
      const fetchPlans = async () => {
        setIsLoadingPlans(true);
        try {
          const response = await fetch('/api/subscription/plans');
          if (!response.ok) {
            throw new Error('Failed to fetch plans');
          }
          const data = await response.json();
          setPlans(data.plans);
        } catch {
          onError('Failed to load plans. Please try again.');
        } finally {
          setIsLoadingPlans(false);
        }
      };
      fetchPlans();
    }
  }, [isOpen, plans.length, onError]);

  const handleSelectPlan = (plan: PlanOption) => {
    setSelectedPlan(plan);
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/subscription/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_price_id: selectedPlan.priceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Parse specific error messages
        if (data.error?.includes('timeout')) {
          throw new Error('Request timed out. Please check your connection and try again.');
        } else if (data.error?.includes('Unauthorized')) {
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (data.error?.includes('Invalid price')) {
          throw new Error('Invalid plan selected. Please try a different plan.');
        } else {
          throw new Error(data.error || 'Failed to update plan');
        }
      }

      onSuccess();
      handleClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update plan. Please try again.');
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setSelectedPlan(null);
      setShowConfirmation(false);
    }
  };

  const handleBack = () => {
    setShowConfirmation(false);
    setSelectedPlan(null);
  };

  const isCurrentPlan = (plan: PlanOption) => {
    return plan.tier === currentTier && plan.billingCycle === currentBillingCycle;
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {!showConfirmation ? (
                  <>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Change Your Plan
                    </Dialog.Title>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-4">
                        Select a new plan to upgrade, downgrade, or change your billing cycle
                      </p>

                      {isLoadingPlans ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <span className="ml-3 text-gray-600">Loading plans...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {plans.map((plan) => {
                            const isCurrent = isCurrentPlan(plan);
                            return (
                              <div
                                key={`${plan.tier}-${plan.billingCycle}`}
                                className={`relative border-2 rounded-lg p-4 ${
                                  isCurrent
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                {isCurrent && (
                                  <div className="absolute top-2 right-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                                      Current Plan
                                    </span>
                                  </div>
                                )}

                                <div className={`${plan.tier === 'PREMIUM' ? 'text-purple-600' : 'text-blue-600'}`}>
                                  <h4 className="text-lg font-semibold">{plan.label}</h4>
                                  <p className="text-sm text-gray-600">{plan.description}</p>
                                </div>

                                <ul className="mt-4 space-y-2">
                                  {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start text-sm text-gray-700">
                                      <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      {feature}
                                    </li>
                                  ))}
                                </ul>

                                <button
                                  onClick={() => handleSelectPlan(plan)}
                                  disabled={isCurrent}
                                  className={`mt-4 w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                                    isCurrent
                                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                      : plan.tier === 'PREMIUM'
                                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {isCurrent ? 'Current Plan' : 'Select Plan'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        onClick={handleClose}
                        disabled={isLoadingPlans}
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Confirm Plan Change
                    </Dialog.Title>
                    <div className="mt-4">
                      <p className="text-sm text-gray-700 mb-4">
                        You&apos;re about to change to <span className="font-semibold">{selectedPlan?.label}</span> for <span className="font-semibold">${selectedPlan?.price}</span>.
                      </p>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Proration Note:</span> Any proration credits or charges will be applied on your next invoice.
                        </p>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          This plan includes:
                        </h4>
                        <ul className="space-y-2">
                          {selectedPlan?.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start text-sm text-gray-700">
                              <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3 justify-end">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleBack}
                        disabled={isSubmitting}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          selectedPlan?.tier === 'PREMIUM'
                            ? 'bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500'
                            : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500'
                        }`}
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </>
                        ) : (
                          'Confirm Change'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
