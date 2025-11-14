import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

// Create Supabase admin client for webhook (bypasses RLS)
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

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
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // Initialize Supabase admin client (bypasses RLS for webhook operations)
    const supabase = getSupabaseAdmin();

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
            // Log and continue to return success to Stripe
          } else if (profile) {
            // Fetch subscription details from Stripe
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            // Extract current_period_end (exists on Subscription, type assertion needed due to SDK types)
            const currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

            // Update profile in Supabase
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: subscription.status,
                stripe_subscription_id: subscription.id,
                trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
              })
              .eq('id', profile.id);

            if (updateError) {
              logger.error('Failed to update profile subscription', new Error(updateError.message), {
                customerId,
                eventType: event.type,
                operation: 'updateSubscription',
                profileId: profile.id,
                subscriptionId
              });
            } else {
              logger.info('Profile subscription updated successfully', {
                customerId,
                eventType: event.type,
                operation: 'updateSubscription',
                profileId: profile.id,
                subscriptionId,
                subscriptionStatus: subscription.status
              });
            }
          } else {
            logger.error('Profile not found for Stripe customer', {
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
          } else if (profile) {
            // Extract current_period_end (exists on Subscription, type assertion needed due to SDK types)
            const currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

            // Update profile in Supabase
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: subscription.status,
                stripe_subscription_id: subscription.id,
                trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
              })
              .eq('id', profile.id);

            if (updateError) {
              logger.error('Failed to update profile subscription', new Error(updateError.message), {
                customerId,
                eventType: event.type,
                operation: 'updateSubscription',
                profileId: profile.id,
                subscriptionId: subscription.id,
                subscriptionStatus: subscription.status
              });
            } else {
              logger.info('Profile subscription updated successfully', {
                customerId,
                eventType: event.type,
                operation: 'updateSubscription',
                profileId: profile.id,
                subscriptionId: subscription.id,
                subscriptionStatus: subscription.status
              });
            }
          } else {
            logger.error('Profile not found for Stripe customer', {
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
          } else if (profile) {
            // Update profile in Supabase to reflect cancellation
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: 'canceled',
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
                profileId: profile.id
              });
            } else {
              logger.info('Profile subscription cancelled successfully', {
                customerId,
                eventType: event.type,
                operation: 'cancelSubscription',
                profileId: profile.id
              });
            }
          } else {
            logger.error('Profile not found for Stripe customer', {
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
          } else if (profile) {
            // Log the trial ending notification
            logger.info('Subscription trial ending soon', {
              customerId,
              eventType: event.type,
              operation: 'trialEndingNotification',
              profileId: profile.id,
              trialEndDate: new Date(trialEndTimestamp * 1000).toISOString()
            });
            // You could send an email notification here or update a flag in the database
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