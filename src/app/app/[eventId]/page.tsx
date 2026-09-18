import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Workspace from "@/components/workspace/Workspace";
import type { EventRow, Hall, MemberRole, Profile, Synagogue } from "@/lib/types";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: event } = await sb.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) redirect("/app");
  const { data: mem } = await sb.from("memberships").select("role").eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!mem && (profile as Profile | null)?.role !== "admin") redirect("/app");
  const [{ data: synas }, { data: halls }] = await Promise.all([
    sb.from("synagogues").select("*").eq("status", "approved"),
    sb.from("halls").select("*"),
  ]);
  return (
    <Workspace
      event={event as EventRow}
      role={(mem?.role as MemberRole) || "viewer"}
      profile={(profile as Profile) || { id: user.id, email: user.email || "", full_name: null, role: "family" }}
      synagogues={(synas as Synagogue[]) || []}
      halls={(halls as Hall[]) || []}
    />
  );
}
