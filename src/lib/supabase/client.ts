import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jgqwqebwfwrtqhcbvrso.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpncXdxZWJ3ZndydHFoY2J2cnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTE1NzksImV4cCI6MjEwNTI4NzU3OX0.yMRE7dUhTAerJIopQWG77LPVure9gFQSqU-YnH5flfM";

export function createClient() {
  return createBrowserClient(url, key);
}
