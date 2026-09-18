import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { EventRow, Profile } from "@/lib/types";

export default async function AppHome() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const p = profile as Profile | null;
  if (p?.role === "vendor") redirect("/vendor");

  const { data: mems } = await sb.from("memberships").select("event_id, role, events(*)").eq("user_id", user.id);
  const events = (mems || []).map((m: { event_id: string; role: string; events: EventRow | EventRow[] | null }) => ({
    role: m.role,
    event: Array.isArray(m.events) ? m.events[0] : m.events,
  })).filter((x) => x.event);

  async function logout() {
    "use server";
    const s = await createClient();
    await s.auth.signOut();
    redirect("/");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex justify-between items-center">
        <div>
          <p className="eyebrow">Simha</p>
          <h1 className="text-3xl mt-1">Vos événements</h1>
          <p className="text-sm text-[var(--muted)]">{user.email}</p>
        </div>
        <form action={logout}>
          <button className="btn btn-ghost" type="submit">
            Se déconnecter
          </button>
        </form>
      </div>
      <div className="grid gap-3 mt-8">
        {events.length === 0 && <p className="text-[var(--muted)]">Aucun événement pour l’instant.</p>}
        {events.map(({ event, role }) => (
          <Link key={event!.id} href={"/app/" + event!.id} className="card p-5 block">
            <b>
              {event!.kind === "bat" ? "Bat" : "Bar"} mitzvah de {event!.child_first_name}
            </b>
            <div className="text-sm text-[var(--muted)]">
              {event!.city} · rôle {role}
            </div>
          </Link>
        ))}
      </div>
      <Link href="/onboarding" className="btn mt-6 inline-flex">
        Créer un événement
      </Link>
      {p?.role === "admin" && (
        <Link href="/admin" className="btn btn-ghost mt-4 inline-flex ml-3">
          Administration
        </Link>
      )}
    </div>
  );
}
