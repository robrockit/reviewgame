import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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
            console.error('Error fetching profile:', profileError.message);
            // Log and continue to return success to Stripe
          } else if (profile) {
            // Fetch subscription details from Stripe
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            // Update profile in Supabase
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: subscription.status,
                stripe_subscription_id: subscription.id,
                trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
              })
              .eq('id', profile.id);

            if (updateError) {
              console.error('Error updating profile subscription:', updateError.message);
            } else {
              console.log(`Profile ${profile.id} subscription updated successfully.`);
            }
          } else {
            console.log(`Profile not found for Stripe customer ID: ${customerId}`);
          }
        } else {
          console.log('Missing customer or subscription ID in checkout.session.completed event.');
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
            console.error('Error fetching profile:', profileError.message);
          } else if (profile) {
            // Update profile in Supabase
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: subscription.status,
                stripe_subscription_id: subscription.id,
                trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
              })
              .eq('id', profile.id);

            if (updateError) {
              console.error('Error updating profile subscription:', updateError.message);
            } else {
              console.log(`Profile ${profile.id} subscription updated successfully.`);
            }
          } else {
            console.log(`Profile not found for Stripe customer ID: ${customerId}`);
          }
        } else {
          console.log('Missing customer ID in customer.subscription.updated event.');
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
            console.error('Error fetching profile:', profileError.message);
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
              console.error('Error updating profile subscription:', updateError.message);
            } else {
              console.log(`Profile ${profile.id} subscription deleted successfully.`);
            }
          } else {
            console.log(`Profile not found for Stripe customer ID: ${customerId}`);
          }
        } else {
          console.log('Missing customer ID in customer.subscription.deleted event.');
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
            console.error('Error fetching profile:', profileError.message);
          } else if (profile) {
            // Log the trial ending notification
            console.log(`Profile ${profile.id} trial will end on ${new Date(trialEndTimestamp * 1000).toLocaleDateString()}`);
            // You could send an email notification here or update a flag in the database
          } else {
            console.log(`Profile not found for Stripe customer ID: ${customerId}`);
          }
        } else {
          console.log('Missing customer ID or trial_end in customer.subscription.trial_will_end event.');
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) { // Catch as unknown by default
    if (error instanceof Error) {
      console.error(`Webhook Error: ${error.message}`);
      return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    } else {
      console.error('An unknown error occurred during webhook processing');
      return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
    }
  }
}