/**
 * @fileoverview Custom Plan Assignment modal component.
 *
 * Allows admins to assign custom pricing plans to users for special cases like:
 * - Bulk school pricing
 * - Partnership agreements
 * - Custom enterprise deals
 *
 * Features:
 * - Two-step confirmation flow (details → confirm)
 * - Custom pricing configuration
 * - Billing period selection (monthly/annual)
 * - Feature limits override (JSON configuration)
 * - Optional expiration date
 * - Full audit logging
 *
 * @module app/admin/users/[userId]/components/CustomPlanModal
 */

'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface CustomPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
  onSuccess: (planDetails: { planName: string; pricing: string; expiresAt?: string }) => void;
}

/**
 * Reason categories for custom plans
 */
const PLAN_CATEGORIES = [
  { value: 'educational', label: 'Educational/School', description: 'Bulk pricing for schools or educational institutions' },
  { value: 'partnership', label: 'Partnership Agreement', description: 'Business partnership or referral agreement' },
  { value: 'enterprise', label: 'Enterprise Deal', description: 'Custom enterprise pricing arrangement' },
  { value: 'non_profit', label: 'Non-Profit Discount', description: 'Discounted pricing for non-profit organizations' },
  { value: 'promotional', label: 'Promotional', description: 'Special promotional pricing' },
  { value: 'other', label: 'Other', description: 'Other custom pricing arrangement' },
] as const;

/**
 * XSS prevention patterns (matching backend validation)
 */
const FORBIDDEN_PATTERNS = [
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters
  /<script[^>]*>.*?<\/script>/gi, // Script tags
  /<iframe[^>]*>.*?<\/iframe>/gi, // Iframes
  /<object[^>]*>.*?<\/object>/gi, // Objects
  /<embed[^>]*>/gi, // Embeds
  /javascript:/gi, // JavaScript protocol
  /vbscript:/gi, // VBScript protocol
  /data:text\/html/gi, // Data URIs
  /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
  /&lt;script/gi, // HTML entity encoded script tags
];

/**
 * Checks if input contains forbidden XSS patterns
 */
function containsForbiddenPatterns(input: string): boolean {
  return FORBIDDEN_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Custom Plan modal component.
 *
 * Provides interface for assigning custom pricing plans to users.
 */
export default function CustomPlanModal({
  isOpen,
  onClose,
  userEmail,
  userId,
  onSuccess,
}: CustomPlanModalProps) {
  // Form state
  const [planName, setPlanName] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState<string>('');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [category, setCategory] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>(''); // ISO date string
  const [featureLimits, setFeatureLimits] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resets all form fields and modal state
   */
  const resetForm = () => {
    setPlanName('');
    setMonthlyPrice('');
    setBillingPeriod('monthly');
    setCategory('');
    setExpirationDate('');
    setFeatureLimits('');
    setNotes('');
    setShowConfirmation(false);
    setSubmitting(false);
    setError(null);
  };

  /**
   * Handles modal close
   */
  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  /**
   * Validates JSON string
   */
  const validateJSON = (jsonString: string): boolean => {
    if (!jsonString.trim()) return true; // Empty is valid (no limits)

    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Validates form inputs
   */
  const validateForm = (): string | null => {
    // Validate plan name
    if (!planName.trim()) {
      return 'Please provide a plan name';
    }

    if (planName.trim().length < 3 || planName.trim().length > 100) {
      return 'Plan name must be between 3 and 100 characters';
    }

    if (containsForbiddenPatterns(planName)) {
      return 'Plan name contains forbidden characters or patterns';
    }

    // Validate pricing
    if (!monthlyPrice.trim()) {
      return 'Please provide a monthly price';
    }

    const price = parseFloat(monthlyPrice);
    if (isNaN(price) || price < 0) {
      return 'Price must be a valid positive number';
    }

    if (price > 10000) {
      return 'Price cannot exceed $10,000/month';
    }

    // Validate category
    if (!category) {
      return 'Please select a reason category';
    }

    if (category === 'other' && !notes.trim()) {
      return 'Notes are required when selecting "Other" category';
    }

    // Validate expiration date (if provided)
    if (expirationDate) {
      const expDate = new Date(expirationDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (expDate < today) {
        return 'Expiration date cannot be in the past';
      }

      // Max 10 years in the future
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 10);
      if (expDate > maxDate) {
        return 'Expiration date cannot be more than 10 years in the future';
      }
    }

    // Validate feature limits (if provided)
    if (featureLimits.trim() && !validateJSON(featureLimits)) {
      return 'Feature limits must be valid JSON';
    }

    // Validate notes
    if (notes.length > 1000) {
      return 'Notes cannot exceed 1000 characters';
    }

    if (notes && containsForbiddenPatterns(notes)) {
      return 'Notes contain forbidden characters or patterns';
    }

    return null;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // First click: show confirmation
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    // Second click: submit the form
    try {
      setSubmitting(true);

      const response = await fetch(`/api/admin/users/${userId}/subscription/custom-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planName: planName.trim(),
          monthlyPrice: parseFloat(monthlyPrice),
          billingPeriod,
          category,
          expirationDate: expirationDate || null,
          featureLimits: featureLimits.trim() ? JSON.parse(featureLimits) : null,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign custom plan');
      }

      // Success!
      const pricingDisplay = billingPeriod === 'annual'
        ? `$${(parseFloat(monthlyPrice) * 12).toFixed(2)}/year`
        : `$${parseFloat(monthlyPrice).toFixed(2)}/month`;

      onSuccess({
        planName: planName.trim(),
        pricing: pricingDisplay,
        expiresAt: expirationDate || undefined,
      });

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setSubmitting(false);
    }
  };

  /**
   * Calculates annual price from monthly
   */
  const getAnnualPrice = (): string => {
    const price = parseFloat(monthlyPrice);
    if (isNaN(price)) return '0.00';
    return (price * 12).toFixed(2);
  };

  /**
   * Formats date for display
   */
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Assign Custom Plan
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">
                        {userEmail}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <div className="mt-1 text-sm text-red-700">
                          {error}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!showConfirmation ? (
                  /* Step 1: Form */
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      {/* Plan Name */}
                      <div>
                        <label htmlFor="planName" className="block text-sm font-medium text-gray-700">
                          Plan Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="planName"
                          value={planName}
                          onChange={(e) => setPlanName(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          placeholder="e.g., School District Bundle, Partner Agreement"
                          disabled={submitting}
                          maxLength={100}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          A descriptive name for this custom plan (3-100 characters)
                        </p>
                      </div>

                      {/* Monthly Price & Billing Period */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="monthlyPrice" className="block text-sm font-medium text-gray-700">
                            Monthly Price (USD) <span className="text-red-500">*</span>
                          </label>
                          <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                              type="number"
                              id="monthlyPrice"
                              value={monthlyPrice}
                              onChange={(e) => setMonthlyPrice(e.target.value)}
                              className="block w-full pl-7 pr-12 border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              max="10000"
                              disabled={submitting}
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="billingPeriod" className="block text-sm font-medium text-gray-700">
                            Billing Period <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="billingPeriod"
                            value={billingPeriod}
                            onChange={(e) => setBillingPeriod(e.target.value as 'monthly' | 'annual')}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            disabled={submitting}
                          >
                            <option value="monthly">Monthly</option>
                            <option value="annual">Annual</option>
                          </select>
                        </div>
                      </div>

                      {/* Price Preview */}
                      {monthlyPrice && (
                        <div className="rounded-md bg-purple-50 p-3 text-sm">
                          <p className="text-gray-700">
                            <strong>Customer will pay:</strong>{' '}
                            {billingPeriod === 'monthly'
                              ? `$${parseFloat(monthlyPrice).toFixed(2)}/month`
                              : `$${getAnnualPrice()}/year (${parseFloat(monthlyPrice).toFixed(2)}/month)`}
                          </p>
                        </div>
                      )}

                      {/* Category */}
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                          Reason Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={submitting}
                        >
                          <option value="">Select a category...</option>
                          {PLAN_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        {category && (
                          <p className="mt-1 text-xs text-gray-500">
                            {PLAN_CATEGORIES.find((c) => c.value === category)?.description}
                          </p>
                        )}
                      </div>

                      {/* Expiration Date */}
                      <div>
                        <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700">
                          Expiration Date (Optional)
                        </label>
                        <input
                          type="date"
                          id="expirationDate"
                          value={expirationDate}
                          onChange={(e) => setExpirationDate(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={submitting}
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Leave empty for no expiration
                        </p>
                      </div>

                      {/* Feature Limits Override */}
                      <div>
                        <label htmlFor="featureLimits" className="block text-sm font-medium text-gray-700">
                          Feature Limits Override (Optional)
                        </label>
                        <textarea
                          id="featureLimits"
                          value={featureLimits}
                          onChange={(e) => setFeatureLimits(e.target.value)}
                          rows={4}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm font-mono text-xs"
                          placeholder='{"max_games": 100, "max_teams": 20, "custom_branding": true}'
                          disabled={submitting}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          JSON object to override default feature limits (leave empty for standard Premium limits)
                        </p>
                      </div>

                      {/* Admin Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                          Admin Notes {category === 'other' && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          placeholder="Additional context, agreement details, or special terms..."
                          disabled={submitting}
                          maxLength={1000}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {notes.length}/1000 characters {category === 'other' && '(Required for "Other" category)'}
                        </p>
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        Review Plan
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Step 2: Confirmation */
                  <div>
                    <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 mb-6">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Please confirm custom plan assignment
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              You are about to assign a custom pricing plan. This will create a new Stripe
                              subscription with custom pricing and update the user&apos;s plan immediately.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Confirmation Details */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
                      <h4 className="font-medium text-gray-900">Plan Details:</h4>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="text-gray-500">Plan Name:</div>
                        <div className="font-medium text-gray-900">{planName}</div>

                        <div className="text-gray-500">Pricing:</div>
                        <div className="font-medium text-gray-900">
                          {billingPeriod === 'monthly'
                            ? `$${parseFloat(monthlyPrice).toFixed(2)}/month`
                            : `$${getAnnualPrice()}/year`}
                        </div>

                        <div className="text-gray-500">Category:</div>
                        <div className="font-medium text-gray-900">
                          {PLAN_CATEGORIES.find((c) => c.value === category)?.label}
                        </div>

                        <div className="text-gray-500">Expires:</div>
                        <div className="font-medium text-gray-900">{formatDate(expirationDate)}</div>

                        {featureLimits.trim() && (
                          <>
                            <div className="text-gray-500">Custom Limits:</div>
                            <div className="font-mono text-xs text-gray-900">Yes</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Confirmation Actions */}
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowConfirmation(false)}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-5 w-5 mr-2" />
                            Confirm & Assign Plan
                          </>
                        )}
                      </button>
                    </div>
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
