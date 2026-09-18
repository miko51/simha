import Link from "next/link";

export default function SiteHeader({ current }: { current?: "home" | "directory" | "vendor" }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link href="/" className="eyebrow">
        Simha
      </Link>
      <nav className="flex flex-wrap gap-2">
        <Link href="/prestataires" className={`btn btn-ghost ${current === "directory" ? "font-bold" : ""}`}>
          Annuaire
        </Link>
        <Link href="/login" className="btn btn-ghost">
          Se connecter
        </Link>
        <Link href="/login?role=family" className="btn">
          Espace famille
        </Link>
        <Link href="/login?role=vendor&next=/vendor" className="btn btn-gold">
          Je suis prestataire
        </Link>
      </nav>
    </header>
  );
}
