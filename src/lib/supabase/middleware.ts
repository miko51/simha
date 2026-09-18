import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuth = path.startsWith("/login") || path.startsWith("/auth") || path === "/" || path.startsWith("/invite");
  if (!user && path.startsWith("/app")) {
    const redir = request.nextUrl.clone();
    redir.pathname = "/login";
    redir.searchParams.set("next", path);
    return NextResponse.redirect(redir);
  }
  if (!user && (path.startsWith("/vendor") || path.startsWith("/admin") || path.startsWith("/onboarding"))) {
    const redir = request.nextUrl.clone();
    redir.pathname = "/login";
    redir.searchParams.set("next", path);
    return NextResponse.redirect(redir);
  }
  if (user && path === "/login") {
    const redir = request.nextUrl.clone();
    redir.pathname = "/app";
    return NextResponse.redirect(redir);
  }
  void isAuth;
  return response;
}
