/**
 * CancelSubscriptionModal Component
 *
 * Modal for canceling user subscription with confirmation
 */

import { Fragment, useState } from 'react';
import { Dialog, Transition, RadioGroup } from '@headlessui/react';
import { format } from 'date-fns';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  currentPeriodEnd: string | null;
}

type CancelOption = 'period_end' | 'immediate';

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  currentPeriodEnd,
}: CancelSubscriptionModalProps) {
  const [selectedOption, setSelectedOption] = useState<CancelOption>('period_end');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          immediate: selectedOption === 'immediate',
          reason: reason.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Parse specific error messages
        if (data.error?.includes('timeout')) {
          throw new Error('Request timed out. Please check your connection and try again.');
        } else if (data.error?.includes('Unauthorized')) {
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (data.error?.includes('already canceled') || data.error?.includes('already cancelled')) {
          throw new Error('This subscription is already canceled.');
        } else if (data.error?.includes('No subscription found')) {
          throw new Error('No active subscription found to cancel.');
        } else {
          throw new Error(data.error || 'Failed to cancel subscription');
        }
      }

      onSuccess();
      onClose();
      // Reset form
      setSelectedOption('period_end');
      setReason('');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to cancel subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      // Reset form
      setSelectedOption('period_end');
      setReason('');
    }
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Cancel Subscription
                </Dialog.Title>
                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to cancel your subscription? You&apos;ll lose access to:
                  </p>
                  <ul className="mt-2 text-sm text-gray-700 list-disc list-inside space-y-1">
                    <li>Custom question banks</li>
                    <li>Video & images in questions</li>
                    <li>Custom team names</li>
                    <li>AI question generation (Premium only)</li>
                    <li>Community question banks (Premium only)</li>
                    <li>Advanced analytics (Premium only)</li>
                  </ul>

                  {/* Cancellation Options */}
                  <div className="mt-6">
                    <RadioGroup value={selectedOption} onChange={setSelectedOption}>
                      <RadioGroup.Label className="text-sm font-medium text-gray-700">
                        When should we cancel?
                      </RadioGroup.Label>
                      <div className="mt-2 space-y-2">
                        <RadioGroup.Option value="period_end">
                          {({ checked }) => (
                            <div className={`flex items-center p-3 rounded-lg border-2 cursor-pointer ${checked ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                              <div className="flex items-center h-5">
                                <input
                                  type="radio"
                                  checked={checked}
                                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                  readOnly
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <RadioGroup.Label as="p" className="font-medium text-gray-900">
                                  At period end (Recommended)
                                </RadioGroup.Label>
                                <RadioGroup.Description as="p" className="text-gray-500">
                                  {currentPeriodEnd ? (
                                    <>Keep access until {format(new Date(currentPeriodEnd), 'MMMM d, yyyy')}</>
                                  ) : (
                                    'Keep access until the end of your current billing period'
                                  )}
                                </RadioGroup.Description>
                              </div>
                            </div>
                          )}
                        </RadioGroup.Option>

                        <RadioGroup.Option value="immediate">
                          {({ checked }) => (
                            <div className={`flex items-center p-3 rounded-lg border-2 cursor-pointer ${checked ? 'border-red-600 bg-red-50' : 'border-gray-200'}`}>
                              <div className="flex items-center h-5">
                                <input
                                  type="radio"
                                  checked={checked}
                                  className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                                  readOnly
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <RadioGroup.Label as="p" className="font-medium text-gray-900">
                                  Cancel immediately
                                </RadioGroup.Label>
                                <RadioGroup.Description as="p" className="text-gray-500">
                                  Lose access right away
                                </RadioGroup.Description>
                              </div>
                            </div>
                          )}
                        </RadioGroup.Option>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Optional Reason */}
                  <div className="mt-6">
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                      Why are you canceling? (Optional)
                    </label>
                    <textarea
                      id="reason"
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Help us improve by sharing your feedback..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {reason.length}/500 characters
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Keep Subscription
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Canceling...
                      </>
                    ) : (
                      'Confirm Cancellation'
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
