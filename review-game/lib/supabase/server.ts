import { stripe } from "@/lib/stripe/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export const createOrRetrieveCustomer = async (
  supabase: SupabaseClient,
  {
    email,
    uuid,
  }: {
    email: string;
    uuid: string;
  }
) => {

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", uuid)
    .single();

  if (error || !data?.stripe_customer_id) {
    const customerData: { metadata: { supabaseUUID: string }; email?: string } =
      {
        metadata: {
          supabaseUUID: uuid,
        },
      };

    if (email) customerData.email = email;

    const customer = await stripe.customers.create(customerData);
    const { error: supabaseError } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("id", uuid);

    if (supabaseError) {
      throw supabaseError;
    }

    logger.info('New Stripe customer created and linked to profile', {
      userId: uuid,
      stripeCustomerId: customer.id,
      operation: 'createStripeCustomer',
    });
    return customer.id;
  }

  return data.stripe_customer_id;
};