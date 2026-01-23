/**
 * @fileoverview Shared subscription type definitions
 *
 * Centralized type definitions for subscription-related data structures
 * used across API endpoints and UI components.
 *
 * @module types/subscription.types
 */

/**
 * Subscription tier levels
 */
export type SubscriptionTier = 'FREE' | 'BASIC' | 'PREMIUM';

/**
 * Subscription status types
 */
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED';

/**
 * Billing cycle types
 */
export type BillingCycle = 'monthly' | 'annual';

/**
 * Stripe subscription item details
 */
export interface SubscriptionItem {
  price: {
    id: string;
    unit_amount: number | null;
    recurring: {
      interval: string;
    } | null;
  };
}

/**
 * Stripe subscription details returned in status response
 */
export interface StripeSubscriptionDetails {
  id: string;
  current_period_end: number;
  current_period_start: number;
  items: SubscriptionItem[];
}

/**
 * Complete subscription status response
 */
export interface SubscriptionStatusResponse {
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  billing_cycle: BillingCycle | null;
  current_period_end: string | null;
  trial_end_date: string | null;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  stripe_subscription: StripeSubscriptionDetails | null;
  games_created_count: number;
  games_limit: number | null;
}

/**
 * Cancel subscription request body
 */
export interface CancelSubscriptionRequest {
  immediate: boolean;
  reason?: string;
}

/**
 * Cancel subscription response
 */
export interface CancelSubscriptionResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    currentPeriodEnd: string;
  };
  error?: string;
}

/**
 * Reactivate subscription response
 */
export interface ReactivateSubscriptionResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
  };
  error?: string;
}

/**
 * Update plan request body
 */
export interface UpdatePlanRequest {
  new_price_id: string;
}

/**
 * Update plan response
 */
export interface UpdatePlanResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    priceId: string;
    currentPeriodEnd: string;
  };
  proration?: {
    amount: number;
    description: string;
  };
  error?: string;
}

/**
 * Portal session response
 */
export interface PortalSessionResponse {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Plan option for UI
 */
export interface PlanOption {
  tier: 'BASIC' | 'PREMIUM';
  billingCycle: BillingCycle;
  priceId: string;
  price: number;
  label: string;
  description: string;
  features: string[];
}

/**
 * Plans list response
 */
export interface PlansResponse {
  plans: PlanOption[];
}
