import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

type CookieOptions = Parameters<ReturnType<typeof NextResponse.next>["cookies"]["set"]>[2];

/**
 * Sanitize Supabase cookie options so SameSite is never weaker than "lax".
 * The @supabase/ssr library occasionally emits sameSite values that are
 * more permissive than needed for first-party auth flows.
 */
function safeCookieOptions(options?: CookieOptions): CookieOptions {
  const sameSite = options?.sameSite;
  const isCrossSiteRequired = typeof sameSite === "string" && sameSite.toLowerCase() === "none";
  return {
    ...options,
    sameSite: isCrossSiteRequired ? "lax" : (sameSite ?? "lax"),
  };
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Updates in-memory request state only — NOT a browser Set-Cookie header.
          // Browser cookies are set via supabaseResponse below with safeCookieOptions.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); // nosemgrep
          supabaseResponse = NextResponse.next({ request });
          // Browser-bound cookies: sameSite enforced to minimum "lax" by safeCookieOptions
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, safeCookieOptions(options))
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/billing") ||
    request.nextUrl.pathname.startsWith("/dashboard");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
