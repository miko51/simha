import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJsClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jgqwqebwfwrtqhcbvrso.supabase.co";
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpncXdxZWJ3ZndydHFoY2J2cnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTE1NzksImV4cCI6MjEwNTI4NzU3OX0.yMRE7dUhTAerJIopQWG77LPVure9gFQSqU-YnH5flfM";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* set from Server Component */
        }
      },
    },
  });
}

export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL || url, key, { auth: { persistSession: false } });
}
