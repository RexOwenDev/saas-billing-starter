import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { createClient } from "@/lib/supabase/server";

const CheckoutRequestSchema = z.object({
  priceId: z.string().min(1),
  interval: z.enum(["month", "year"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = CheckoutRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { priceId, successUrl, cancelUrl } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Skeleton: maps user directly to org. A real multi-tenant app queries
  // organization_members to resolve the active org for this user.
  const orgId = user.id;

  try {
    const session = await createCheckoutSession({
      orgId,
      userEmail: user.email ?? "",
      priceId,
      billingInterval: parsed.data.interval,
      successUrl: successUrl ?? `${appUrl}/billing?success=true`,
      cancelUrl: cancelUrl ?? `${appUrl}/pricing`,
      trialDays: 14,
      idempotencyKey: `checkout_${orgId}_${priceId}_${Date.now()}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/billing/checkout]", message);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
