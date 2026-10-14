import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseEnv } from "./env";

const PROTECTED_PREFIXES = ["/cases", "/start"];

/** Refreshes the auth session cookie and guards signed-in-only routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes
  // the session and must run on every request.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }

  return response;
}
