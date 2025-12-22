import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createOrRetrieveCustomer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to create a checkout session' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { priceId } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Create or retrieve Stripe customer
    const customerId = await createOrRetrieveCustomer(supabase, {
      uuid: user.id,
      email: user.email || '',
    });

    if (!customerId) {
      return NextResponse.json(
        { error: 'Failed to create or retrieve customer' },
        { status: 500 }
      );
    }

    // Robust subscription detection using actual price IDs
    const basicPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
    ].filter(Boolean);

    const premiumPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID,
    ].filter(Boolean);

    const allSubscriptionPriceIds = [...basicPriceIds, ...premiumPriceIds];
    const isSubscription = allSubscriptionPriceIds.includes(priceId);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.nextUrl.origin}/pricing?payment=success`,
      cancel_url: `${req.nextUrl.origin}/pricing?payment=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      // Add 30-day trial period for all subscriptions (BASIC and PREMIUM)
      ...(isSubscription && {
        subscription_data: {
          trial_period_days: 30,
        },
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
