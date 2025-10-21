import { stripe } from "@/lib/stripe/server";
import { createOrRetrieveCustomer } from "@/lib/supabase/server";
import { getURL } from "@/lib/utils/helpers";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (req.method !== "POST") {
    return new NextResponse("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
        async set(name: string, value: string, options) {
          (await cookieStore).set(name, value, options);
        },
        async remove(name: string, options) {
          (await cookieStore).set(name, "", options);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const customer = await createOrRetrieveCustomer(supabase, {
    uuid: user.id || "",
    email: user.email || "",
  });

  if (!customer) {
    return new NextResponse("Could not get customer", { status: 500 });
  }

  const { priceId, quantity = 1, metadata = {} } = await req.json();

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      billing_address_collection: "required",
      customer,
      line_items: [
        {
          price: priceId, // Use priceId for subscriptions
          quantity,
        },
      ],
      mode: "subscription", // Set mode to subscription
      allow_promotion_codes: true,
      success_url: `${getURL()}/account`,
      cancel_url: `${getURL()}/`,
      metadata,
    });

    if (session) {
      return NextResponse.json({ sessionId: session.id });
    } else {
      return new NextResponse("Could not create session", { status: 500 });
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err.message);
      return new NextResponse(err.message, { status: 500 });
    }
    console.error("An unknown error occurred");
    return new NextResponse("An unknown error occurred", { status: 500 });
  }
}