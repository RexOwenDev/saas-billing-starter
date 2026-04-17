import { type NextRequest, NextResponse } from "next/server";
import { createPortalSession } from "@/lib/stripe/portal";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const orgId = user.id; // Simplified; use real org lookup in production

  try {
    const { url } = await createPortalSession({
      orgId,
      returnUrl: `${appUrl}/billing`,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/billing/portal]", message);
    // Redirect back with an error query param rather than showing a blank error
    return NextResponse.redirect(
      new URL("/billing?error=portal_unavailable", request.url)
    );
  }
}
