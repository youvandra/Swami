import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, accountsOn } from "./lib/db/config";
import { safeNext } from "./lib/safe-next";

// Keeps the Supabase session fresh, sends signed-out visitors of /app to the login page and signed-in ones
// from /login to the app. With accounts off, the app runs locally and every route stays open.
export async function proxy(request: NextRequest) {
  if (!accountsOn) return NextResponse.next();
  const path = request.nextUrl.pathname;

  // A sign-in link that fell back to the Site URL lands on / with its code: finish signing in, then open the app.
  const params = request.nextUrl.searchParams;
  if (path !== "/auth/callback" && (params.has("code") || params.has("token_hash"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (!params.has("next")) url.searchParams.set("next", "/app");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (data.user && path === "/login") return NextResponse.redirect(new URL(safeNext(params.get("next")), request.url));
  if (!data.user && (path.startsWith("/app") || path.startsWith("/print"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/", "/login", "/app/:path*", "/print/:path*", "/api/:path*"] };
