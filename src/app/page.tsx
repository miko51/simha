import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="eyebrow">Simha</div>
        <div className="flex gap-3">
          <Link href="/login" className="btn btn-ghost">Se connecter</Link>
          <Link href="/login?role=family" className="btn">Créer un espace famille</Link>
        </div>
      </header>
      <section className="mt-16">
        <p className="eyebrow">Bar &amp; bat mitzvah · gratuit pour les familles</p>
        <h1 className="text-4xl md:text-5xl mt-3 leading-tight">Organisez la simha de votre enfant, ensemble.</h1>
        <p className="text-[var(--muted)] mt-4 max-w-2xl text-lg">
          Budget, échéancier, invités, rétroplanning et déroulé des jours J — plus un assistant IA ancré sur le calendrier juif (paracha, nérot, Omer). Les prestataires abonnés apparaissent selon votre ville et votre enveloppe.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/login?role=family" className="btn">Commencer gratuitement</Link>
          <Link href="/login?role=vendor" className="btn btn-gold">Je suis prestataire</Link>
        </div>
      </section>
      <section className="grid md:grid-cols-3 gap-4 mt-16">
        {[
          ["Famille", "Inscrivez-vous, invitez les grands-parents, collaborez en direct sur le budget et la liste d’invités."],
          ["Calendrier juif", "Hebcal calcule la paracha, les fêtes et les horaires. L’IA commente, elle n’invente pas les heures."],
          ["Prestataires", "Salle, traiteur, DJ, déco, fleuriste… ils paient un abonnement mensuel pour apparaître dans l’annuaire ciblé."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <h2 className="text-xl">{t}</h2>
            <p className="text-sm text-[var(--muted)] mt-2">{d}</p>
          </div>
        ))}
      </section>
      <p className="foot text-xs text-[var(--muted)] mt-16">Les familles ne paient rien. Avis rabbinique à confirmer pour les dates et minhagim.</p>
    </div>
  );
}
