import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Validate required environment variables at module load
const requiredEnvVars = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnvVars.length > 0) {
  const errorMessage = `Missing required environment variables for Stripe webhook: ${missingEnvVars.join(', ')}`;
  console.error('❌', errorMessage);
  throw new Error(errorMessage);
}

// Initialize Stripe with validated secret key
const stripe = new Stripe(requiredEnvVars.STRIPE_SECRET_KEY, {
  typescript: true,
});

// Create Supabase admin client for webhook (bypasses RLS)
const getSupabaseAdmin = () => {
  return createClient(
    requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL,
    requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

/**
 * Maps a Stripe price ID to subscription tier and billing cycle.
 * Returns null if the price ID doesn't match any known subscription.
 */
interface PriceMapping {
  tier: 'BASIC' | 'PREMIUM';
  billingCycle: 'monthly' | 'annual';
}

function getPriceMapping(priceId: string): PriceMapping | null {
  // Map price IDs to tiers and billing cycles
  const priceMap: Record<string, PriceMapping> = {};

  // Basic tier
  if (process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID) {
    priceMap[process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID] = {
      tier: 'BASIC',
      billingCycle: 'monthly',
    };
  }
  if (process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID) {
    priceMap[process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID] = {
      tier: 'BASIC',
      billingCycle: 'annual',
    };
  }

  // Premium tier
  if (process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID) {
    priceMap[process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID] = {
      tier: 'PREMIUM',
      billingCycle: 'monthly',
    };
  }
  if (process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID) {
    priceMap[process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID] = {
      tier: 'PREMIUM',
      billingCycle: 'annual',
    };
  }

  return priceMap[priceId] || null;
}

/**
 * Safely extracts the price ID from a Stripe subscription.
 * Returns null if subscription has no items or invalid data.
 */
function extractPriceId(subscription: Stripe.Subscription): string | null {
  if (!subscription.items?.data || subscription.items.data.length === 0) {
    logger.error('Subscription has no items', {
      subscriptionId: subscription.id,
      operation: 'extractPriceId'
    });
    return null;
  }

  const priceId = subscription.items.data[0]?.price?.id;

  if (!priceId) {
    logger.error('Subscription item missing price ID', {
      subscriptionId: subscription.id,
      itemCount: subscription.items.data.length,
      operation: 'extractPriceId'
    });
    return null;
  }

  return priceId;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    return NextResponse.json({ error: 'Stripe-Signature header missing' }, { status: 400 });
  }

  try {
    // Verify the event
    const event: Stripe.Event = stripe.webhooks.constructEvent(
      body,
      signature,
      requiredEnvVars.STRIPE_WEBHOOK_SECRET
    );

    // Initialize Supabase admin client (bypasses RLS for webhook operations)
    const supabase = getSupabaseAdmin();

    // Check for duplicate events (idempotency)
    const { data: existingEvents } = await supabase
      .from('processed_stripe_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .limit(1);

    if (existingEvents && existingEvents.length > 0) {
      logger.info('Duplicate webhook event ignored', {
        eventId: event.id,
        eventType: event.type,
        operation: 'idempotencyCheck'
      });
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (customerId && subscriptionId) {
          // Fetch profile from Supabase
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profileError) {
            logger.error('Failed to fetch profile for Stripe customer', new Error(profileError.message), {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
            // Return 500 to trigger Stripe retry for database errors
            return NextResponse.json(
              { error: 'Failed to fetch profile' },
              { status: 500 }
            );
          }

          if (profile) {
            // Fetch subscription details from Stripe
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            // Extract the price ID from the subscription
            const priceId = extractPriceId(subscription);

            if (!priceId) {
              logger.error('Cannot process checkout without valid price ID', {
                customerId,
                subscriptionId,
                eventType: event.type,
                operation: 'validatePriceId'
              });
              break;
            }

            const priceMapping = getPriceMapping(priceId);

            if (!priceMapping) {
              logger.error('Unknown price ID in checkout session', {
                customerId,
                subscriptionId,
                priceId,
                eventType: event.type,
                operation: 'mapPriceId'
              });
              // Default to FREE tier if price ID not recognized
            }

            // Calculate trial end date (30 days from now as configured in checkout session)
            const trialEndDate = subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null;

            // Update profile in Supabase with tier and billing cycle
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: 'TRIAL', // Set to TRIAL for new subscriptions
                subscription_tier: priceMapping?.tier || 'FREE',
                billing_cycle: priceMapping?.billingCycle || null,
                stripe_subscription_id: subscription.id,
                trial_end_date: trialEndDate,
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              })
              .eq('id', profile.id);

            if (updateError) {
              logger.error('Failed to update profile subscription', new Error(updateError.message), {
                customerId,
                eventType: event.type,
                operation: 'updateSubscription',
                profileId: profile.id,
                subscriptionId,
                priceId,
                tier: priceMapping?.tier,
                billingCycle: priceMapping?.billingCycle
              });
              // Return 500 to trigger Stripe retry
              return NextResponse.json(
                { error: 'Failed to update subscription' },
                { status: 500 }
              );
            }

            logger.info('Profile subscription started successfully', {
              customerId,
              eventType: event.type,
              operation: 'updateSubscription',
              profileId: profile.id,
              subscriptionId,
              tier: priceMapping?.tier,
              billingCycle: priceMapping?.billingCycle,
              status: 'TRIAL',
              trialEndDate
            });
          } else {
            // Profile not found - log but return 200 to avoid infinite retries
            logger.warn('Profile not found for Stripe customer, skipping webhook', {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
          }
        } else {
          logger.error('Missing customer or subscription ID in webhook event', {
            eventType: event.type,
            operation: 'validateEventData',
            hasCustomerId: !!customerId,
            hasSubscriptionId: !!subscriptionId
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        if (customerId) {
          // Fetch profile from Supabase to check for tier changes
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, subscription_tier, subscription_status')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profileError) {
            logger.error('Failed to fetch profile for Stripe customer', new Error(profileError.message), {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
            // Return 500 to trigger Stripe retry for database errors
            return NextResponse.json(
              { error: 'Failed to fetch profile' },
              { status: 500 }
            );
          }

          if (profile) {
            // Extract the price ID from the subscription to determine tier
            const priceId = extractPriceId(subscription);
            const priceMapping = priceId ? getPriceMapping(priceId) : null;

            if (priceId && !priceMapping) {
              logger.warn('Unknown price ID in subscription update', {
                customerId,
                subscriptionId: subscription.id,
                priceId,
                eventType: event.type,
                operation: 'mapPriceId'
              });
            }

            // Map Stripe's status to our status types
            // 'trialing' -> 'TRIAL', 'active' -> 'ACTIVE', 'past_due' -> 'past_due', etc.
            let mappedStatus = subscription.status.toUpperCase();
            if (mappedStatus === 'TRIALING') {
              mappedStatus = 'TRIAL';
            }

            // Detect tier changes (upgrade/downgrade)
            const oldTier = profile.subscription_tier;
            const newTier = priceMapping?.tier || profile.subscription_tier;
            const tierChanged = oldTier !== newTier;

            // Check if subscription is being cancelled (cancel_at_period_end = true)
            const isCancelling = subscription.cancel_at_period_end === true;

            // Update profile in Supabase
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: mappedStatus,
                subscription_tier: newTier,
                billing_cycle: priceMapping?.billingCycle || null,
                stripe_subscription_id: subscription.id,
                trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              })
              .eq('id', profile.id);

            if (updateError) {
              logger.error('Failed to update profile subscription', new Error(updateError.message), {
                customerId,
                eventType: event.type,
                operation: 'updateSubscription',
                profileId: profile.id,
                subscriptionId: subscription.id,
                subscriptionStatus: mappedStatus,
                priceId,
                tier: newTier,
                tierChanged,
                isCancelling
              });
              // Return 500 to trigger Stripe retry
              return NextResponse.json(
                { error: 'Failed to update subscription' },
                { status: 500 }
              );
            }

            logger.info('Profile subscription updated successfully', {
              customerId,
              eventType: event.type,
              operation: 'updateSubscription',
              profileId: profile.id,
              subscriptionId: subscription.id,
              subscriptionStatus: mappedStatus,
              oldTier,
              newTier,
              tierChanged,
              billingCycle: priceMapping?.billingCycle,
              isCancelling,
              cancelAtPeriodEnd: subscription.cancel_at_period_end
            });
          } else {
            // Profile not found - log but return 200 to avoid infinite retries
            logger.warn('Profile not found for Stripe customer, skipping webhook', {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
          }
        } else {
          logger.error('Missing customer ID in webhook event', {
            eventType: event.type,
            operation: 'validateEventData'
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        if (customerId) {
          // Fetch profile from Supabase to check subscription status
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, subscription_status')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profileError) {
            logger.error('Failed to fetch profile for Stripe customer', new Error(profileError.message), {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
            // Return 500 to trigger Stripe retry for database errors
            return NextResponse.json(
              { error: 'Failed to fetch profile' },
              { status: 500 }
            );
          }

          if (profile) {
            // Determine if this was a trial expiration or a paid subscription cancellation
            const wasTrialing = profile.subscription_status === 'TRIAL' || profile.subscription_status === 'trialing';
            const status = wasTrialing ? 'TRIAL_EXPIRED' : 'CANCELLED';

            // Update profile in Supabase to reflect cancellation/expiration
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: status,
                subscription_tier: 'FREE', // Downgrade to free tier
                billing_cycle: null, // Clear billing cycle
                stripe_subscription_id: null,
                trial_end_date: null,
                current_period_end: null,
              })
              .eq('id', profile.id);

            if (updateError) {
              logger.error('Failed to cancel profile subscription', new Error(updateError.message), {
                customerId,
                eventType: event.type,
                operation: 'cancelSubscription',
                profileId: profile.id,
                status,
                wasTrialing
              });
              // Return 500 to trigger Stripe retry
              return NextResponse.json(
                { error: 'Failed to cancel subscription' },
                { status: 500 }
              );
            }

            logger.info('Profile subscription cancelled successfully', {
              customerId,
              eventType: event.type,
              operation: 'cancelSubscription',
              profileId: profile.id,
              status,
              wasTrialing,
              // TODO(RG-84): Schedule cleanup of custom content (30 days)
              // This could be implemented as a database function or background job
              cleanupScheduled: false
            });
          } else {
            // Profile not found - log but return 200 to avoid infinite retries
            logger.warn('Profile not found for Stripe customer, skipping webhook', {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
          }
        } else {
          logger.error('Missing customer ID in webhook event', {
            eventType: event.type,
            operation: 'validateEventData'
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (customerId && subscriptionId) {
          // Fetch profile from Supabase
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, subscription_status')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profileError) {
            logger.error('Failed to fetch profile for Stripe customer', new Error(profileError.message), {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
            // Return 500 to trigger Stripe retry for database errors
            return NextResponse.json(
              { error: 'Failed to fetch profile' },
              { status: 500 }
            );
          }

          if (profile) {
            // Check if this is the first payment after trial (transition from TRIAL to ACTIVE)
            const wasTrialing = profile.subscription_status === 'TRIAL' || profile.subscription_status === 'trialing';

            // If transitioning from trial, update status to ACTIVE
            if (wasTrialing) {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  subscription_status: 'ACTIVE',
                  trial_end_date: null, // Clear trial end date
                })
                .eq('id', profile.id);

              if (updateError) {
                logger.error('Failed to activate subscription after trial', new Error(updateError.message), {
                  customerId,
                  eventType: event.type,
                  operation: 'activateSubscription',
                  profileId: profile.id,
                  subscriptionId
                });
                // Return 500 to trigger Stripe retry
                return NextResponse.json(
                  { error: 'Failed to activate subscription' },
                  { status: 500 }
                );
              }

              logger.info('Subscription activated after trial', {
                customerId,
                eventType: event.type,
                operation: 'activateSubscription',
                profileId: profile.id,
                subscriptionId,
                invoiceId: invoice.id,
                amountPaid: invoice.amount_paid
              });
            } else {
              // Log successful payment for active subscription
              logger.info('Payment succeeded for active subscription', {
                customerId,
                eventType: event.type,
                operation: 'logPayment',
                profileId: profile.id,
                subscriptionId,
                invoiceId: invoice.id,
                amountPaid: invoice.amount_paid
              });
            }
          } else {
            // Profile not found - log but return 200 to avoid infinite retries
            logger.warn('Profile not found for Stripe customer, skipping webhook', {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
          }
        } else {
          logger.error('Missing customer or subscription ID in webhook event', {
            eventType: event.type,
            operation: 'validateEventData',
            hasCustomerId: !!customerId,
            hasSubscriptionId: !!subscriptionId
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (customerId && subscriptionId) {
          // Fetch profile from Supabase
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profileError) {
            logger.error('Failed to fetch profile for Stripe customer', new Error(profileError.message), {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
            // Return 500 to trigger Stripe retry for database errors
            return NextResponse.json(
              { error: 'Failed to fetch profile' },
              { status: 500 }
            );
          }

          if (profile) {
            // Update subscription status to past_due
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: 'past_due',
              })
              .eq('id', profile.id);

            if (updateError) {
              logger.error('Failed to mark subscription as past_due', new Error(updateError.message), {
                customerId,
                eventType: event.type,
                operation: 'markPastDue',
                profileId: profile.id,
                subscriptionId
              });
              // Return 500 to trigger Stripe retry
              return NextResponse.json(
                { error: 'Failed to mark subscription as past_due' },
                { status: 500 }
              );
            }

            logger.info('Subscription marked as past_due', {
              customerId,
              eventType: event.type,
              operation: 'markPastDue',
              profileId: profile.id,
              subscriptionId,
              invoiceId: invoice.id,
              attemptCount: invoice.attempt_count,
              // TODO(RG-85): Trigger payment reminder email
              // This could be implemented using a service like SendGrid or Resend
              emailTriggered: false
            });
          } else {
            // Profile not found - log but return 200 to avoid infinite retries
            logger.warn('Profile not found for Stripe customer, skipping webhook', {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
          }
        } else {
          logger.error('Missing customer or subscription ID in webhook event', {
            eventType: event.type,
            operation: 'validateEventData',
            hasCustomerId: !!customerId,
            hasSubscriptionId: !!subscriptionId
          });
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const trialEndTimestamp = subscription.trial_end;

        if (customerId && trialEndTimestamp) {
          // Fetch profile from Supabase
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profileError) {
            logger.error('Failed to fetch profile for Stripe customer', new Error(profileError.message), {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
            // Return 500 to trigger Stripe retry for database errors
            return NextResponse.json(
              { error: 'Failed to fetch profile' },
              { status: 500 }
            );
          }

          if (profile) {
            // Log the trial ending notification
            logger.info('Subscription trial ending soon', {
              customerId,
              eventType: event.type,
              operation: 'trialEndingNotification',
              profileId: profile.id,
              trialEndDate: new Date(trialEndTimestamp * 1000).toISOString()
            });
            // TODO: Send reminder email (3 days before trial ends)
            // This could be implemented using a service like SendGrid or Resend
          } else {
            logger.error('Profile not found for Stripe customer', {
              customerId,
              eventType: event.type,
              operation: 'fetchProfile'
            });
          }
        } else {
          logger.error('Missing customer ID or trial_end in webhook event', {
            eventType: event.type,
            operation: 'validateEventData',
            hasCustomerId: !!customerId,
            hasTrialEnd: !!trialEndTimestamp
          });
        }
        break;
      }

      default:
        logger.info('Unhandled Stripe event type received', {
          eventType: event.type,
          operation: 'handleWebhookEvent'
        });
    }

    // Record successful event processing for idempotency
    const { error: insertError } = await supabase
      .from('processed_stripe_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        processed_at: new Date().toISOString()
      });

    if (insertError) {
      logger.error('Failed to record processed webhook event', new Error(insertError.message), {
        eventId: event.id,
        eventType: event.type,
        operation: 'recordProcessedEvent'
      });
      // Still return success to Stripe since the event was processed
      // The idempotency check will fail next time but event won't be lost
    }

    return NextResponse.json({ received: true });
  } catch (error) { // Catch as unknown by default
    if (error instanceof Error) {
      logger.error('Webhook handler failed', error, {
        operation: 'processWebhook'
      });
      return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    } else {
      logger.error('Unknown error occurred during webhook processing', new Error('Unknown webhook error'), {
        operation: 'processWebhook',
        errorType: typeof error
      });
      return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
    }
  }
}