import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: invite } = await sb.from("invites").select("*").eq("token", token).maybeSingle();
  if (!invite) {
    return (
      <div className="max-w-md mx-auto p-8">
        <h1>Invitation invalide</h1>
        <Link href="/login">Se connecter</Link>
      </div>
    );
  }
  if (invite.accepted_at) redirect("/app/" + invite.event_id);
  if (new Date(invite.expires_at) < new Date()) {
    return <div className="p-8">Invitation expirée.</div>;
  }
  if (!user) {
    redirect("/login?next=" + encodeURIComponent("/invite/" + token));
  }
  if (user.email && user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="max-w-lg mx-auto p-8 card mt-12">
        <h1 className="text-2xl">Mauvais compte</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          Cette invitation est pour {invite.email}. Vous êtes connecté en {user.email}.
        </p>
      </div>
    );
  }
  await sb.from("memberships").upsert({ event_id: invite.event_id, user_id: user.id, role: invite.role }, { onConflict: "event_id,user_id" });
  await sb.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  redirect("/app/" + invite.event_id);
}
