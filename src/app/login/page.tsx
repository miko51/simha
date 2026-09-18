"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Suspense } from "react";

function LoginInner() {
  const sp = useSearchParams();
  const initial = (sp.get("role") === "vendor" ? "vendor" : "family") as "family" | "vendor";
  const [role, setRole] = useState<"family" | "vendor">(initial);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = sp.get("next") || (role === "vendor" ? "/vendor" : "/app");
  const origin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("Envoi du lien…");
    setOk(false);
    const sb = createClient();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { role },
      },
    });
    setBusy(false);
    if (error) {
      setMsg("Envoi impossible : " + error.message);
      return;
    }
    setOk(true);
    setMsg("Lien envoyé. Ouvre-le sur cet appareil pour te connecter.");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12">
      <form onSubmit={submit} className="card p-7 max-w-md w-full grid gap-3 border-t-4 border-[var(--gold)]">
        <p className="eyebrow">Espace privé</p>
        <h1 className="text-3xl">Connexion Simha</h1>
        <p className="text-[var(--muted)] text-sm">Lien magique par email. Pas de mot de passe.</p>
        <div className="flex gap-2 mt-1">
          <button type="button" className={`btn ${role === "family" ? "" : "btn-ghost"}`} onClick={() => setRole("family")}>
            Famille
          </button>
          <button type="button" className={`btn ${role === "vendor" ? "" : "btn-ghost"}`} onClick={() => setRole("vendor")}>
            Prestataire
          </button>
        </div>
        <label className="text-sm font-semibold text-[var(--muted)] mt-2">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" autoComplete="email" />
        <button className="btn" disabled={busy} type="submit">
          Recevoir mon lien de connexion
        </button>
        <p className={`text-sm min-h-[1.4em] ${ok ? "text-[var(--ok)]" : "text-[var(--muted)]"}`}>{msg}</p>
        <Link href="/" className="text-sm text-[var(--tekhelet)]">
          Retour à l’accueil
        </Link>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
