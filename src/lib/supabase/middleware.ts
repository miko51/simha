import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jgqwqebwfwrtqhcbvrso.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpncXdxZWJ3ZndydHFoY2J2cnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTE1NzksImV4cCI6MjEwNTI4NzU3OX0.yMRE7dUhTAerJIopQWG77LPVure9gFQSqU-YnH5flfM";
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !url) return response;

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
  const nextPath = path + (request.nextUrl.search || "");
  if (!user && path.startsWith("/app")) {
    const redir = request.nextUrl.clone();
    redir.pathname = "/login";
    redir.search = "";
    redir.searchParams.set("next", nextPath);
    return NextResponse.redirect(redir);
  }
  if (!user && (path.startsWith("/vendor") || path.startsWith("/admin") || path.startsWith("/onboarding"))) {
    const redir = request.nextUrl.clone();
    redir.pathname = "/login";
    redir.search = "";
    redir.searchParams.set("role", path.startsWith("/vendor") ? "vendor" : "family");
    redir.searchParams.set("next", nextPath);
    return NextResponse.redirect(redir);
  }
  if (user && path === "/login") {
    const raw = request.nextUrl.searchParams.get("next") || "/app";
    const dest = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
    return NextResponse.redirect(new URL(dest, request.url));
  }
  return response;
}
