import { addDays } from "@/lib/money";
import type { EventKind } from "@/lib/types";

export type QtyKey = number | "guests" | "gTef" | "gKid" | "gDej";
export type BaseItem = [string, string, QtyKey, number, string, boolean?];
export type BaseGroup = { id: string; title: string; when: (e: EventDates) => string; items: BaseItem[] };
export type RelPay = { l: string; p: number; from: "tef" | "shab" | "soir"; days: number };

export type EventDates = {
  child: string;
  kind: EventKind;
  tefilin?: string | null;
  shabbat?: string | null;
  party?: string | null;
  city?: string;
};

export const QK: Record<string, string> = {
  fixe: "Quantité fixe",
  guests: "× invités soirée",
  gTef: "× invités tefilin",
  gKid: "× invités kiddouch",
  gDej: "× invités déjeuner",
};

const kindLabel = (k: EventKind) => (k === "bat" ? "bat mitzvah" : "bar mitzvah");

export function baseGroups(e: EventDates): BaseGroup[] {
  const child = e.child || "l’enfant";
  return [
    {
      id: "tef",
      title: "Pose des tefilin",
      when: (x) =>
        [x.tefilin ? new Date(x.tefilin + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à fixer", "synagogue + petit-déjeuner"].join(" · "),
      items: [
        ["tefilin", "Paire de tefilin (qualité mehoudar, sofer reconnu)", 1, 1100, "Commander 3–4 mois avant : délai du sofer"],
        ["talit", "Talit, sac brodé au prénom, kippot assorties", 1, 300, ""],
        ["pdj", "Petit-déjeuner traiteur casher", "gTef", 28, "Viennoiseries, salé, boissons chaudes"],
        ["mat", "Location tables / nappage si hors synagogue", 1, 250, "Souvent inclus à la synagogue"],
        ["photo1", "Photographe (2 h le matin)", 1, 450, "Pas de photo le Shabbat : ce matin-là est clé"],
        ["don1", "Dons synagogue, rabbin, ’hazan", 1, 500, ""],
      ],
    },
    {
      id: "shab",
      title: "Montée à la Torah & Shabbat",
      when: (x) =>
        [x.shabbat ? new Date(x.shabbat + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à fixer", "synagogue + déjeuner"].join(" · "),
      items: [
        ["cours", `Cours de paracha, haftara et drasha`, 40, 45, "≈ 1 séance/semaine d’octobre au jour J"],
        ["kid", "Kiddouch à la synagogue", "gKid", 14, ""],
        ["bonbons", "Bonbons à lancer + sachets", 1, 80, ""],
        ["dej", "Déjeuner familial (traiteur livré la veille)", "gDej", 48, "Plats chauds sur plata / chabbat"],
        ["vais", "Vaisselle, nappes, extras maison", 1, 250, ""],
        ["serv", "Extra service / plonge (préparé avant Shabbat)", 1, 300, "Optionnel"],
        ["don2", "Dons (alyot, synagogue)", 1, 800, ""],
        ["tenueR", `Costume / tenue de ${child}`, 1, 650, "Prévoir une 2ᵉ tenue pour la soirée si souhaité"],
      ],
    },
    {
      id: "soir",
      title: `Soirée de ${kindLabel(e.kind)}`,
      when: (x) =>
        [x.party ? new Date(x.party + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à fixer", x.city || "salle"].join(" · "),
      items: [
        ["salle", "Location de la salle", 1, 0, "À renseigner avec le montant du contrat", true],
        ["traiteur", "Traiteur casher : cocktail + dîner + dessert", "guests", 145, "Haut de gamme : 120–180 € selon menu et service"],
        ["boissons", "Boissons, open bar, droit de bouchon", "guests", 25, ""],
        ["gateau", "Pièce montée / wedding cake / candy bar", 1, 1200, ""],
        ["dj", "DJ + sonorisation + lumières", 1, 2800, "Les jeudis et samedis partent vite"],
        ["entree", "Animation d’entrée (percussions, danseurs, chaise)", 1, 1500, ""],
        ["live", "Musique live au cocktail (violon, chanteur)", 1, 1000, ""],
        ["ados", "Espace ados : animateur, jeux, photobooth", 1, 1400, ""],
        ["fleurs", "Fleurs & centres de table (≈ 18 tables)", 18, 140, ""],
        ["sceno", "Scénographie, lettres lumineuses, mapping", 1, 1800, ""],
        ["photo2", "Photographe + vidéaste (soirée)", 1, 3200, "Inclure un teaser rendu sous 1 semaine"],
        ["film", `Film « ${child} de 0 à 13 ans » projeté`, 1, 700, ""],
        ["papeterie", "Save-the-date, faire-part, menus, plan de table", 1, 1100, ""],
        ["rsvp", "Site RSVP / invitations digitales", 1, 60, ""],
        ["cadeaux", "Souvenirs invités", "guests", 6, ""],
        ["tenues", "Tenues famille, coiffure, maquillage", 1, 2200, ""],
        ["logistique", "Voiturier, vestiaire, sécurité", 1, 1300, "Vérifier ce qu’inclut la salle"],
        ["assur", "Assurance annulation événement", 1, 450, ""],
      ],
    },
  ];
}

export const SCHED: Record<string, RelPay[]> = {
  "tef.tefilin": [
    { l: "Acompte à la commande", p: 50, from: "tef", days: -150 },
    { l: "Solde à la livraison", p: 50, from: "tef", days: -30 },
  ],
  "tef.talit": [{ l: "Achat", p: 100, from: "tef", days: -45 }],
  "tef.pdj": [{ l: "Règlement traiteur", p: 100, from: "tef", days: -3 }],
  "tef.mat": [{ l: "Règlement", p: 100, from: "tef", days: -3 }],
  "tef.photo1": [
    { l: "Acompte", p: 30, from: "tef", days: -120 },
    { l: "Solde", p: 70, from: "tef", days: 0 },
  ],
  "tef.don1": [{ l: "Dons", p: 100, from: "tef", days: 0 }],
  "shab.cours": Array.from({ length: 8 }, (_, i) => ({
    l: `Cours – mensualité ${i + 1}/8`,
    p: 12.5,
    from: "shab" as const,
    days: -240 + i * 30,
  })),
  "shab.kid": [
    { l: "Acompte", p: 30, from: "shab", days: -60 },
    { l: "Solde", p: 70, from: "shab", days: -2 },
  ],
  "shab.bonbons": [{ l: "Achat", p: 100, from: "shab", days: -7 }],
  "shab.dej": [{ l: "Règlement traiteur", p: 100, from: "shab", days: -2 }],
  "shab.vais": [{ l: "Achats", p: 100, from: "shab", days: -7 }],
  "shab.serv": [{ l: "Règlement extra", p: 100, from: "shab", days: -1 }],
  "shab.don2": [{ l: "Dons promis à la Torah", p: 100, from: "shab", days: 2 }],
  "shab.tenueR": [{ l: "Achat", p: 100, from: "shab", days: -45 }],
  "soir.salle": [
    { l: "Acompte", p: 30, from: "soir", days: -240 },
    { l: "Solde", p: 70, from: "soir", days: -30 },
  ],
  "soir.traiteur": [
    { l: "Acompte à la signature", p: 30, from: "soir", days: -210 },
    { l: "2ᵉ acompte", p: 40, from: "soir", days: -90 },
    { l: "Solde sur nombre définitif", p: 30, from: "soir", days: -7 },
  ],
  "soir.boissons": [{ l: "Règlement", p: 100, from: "soir", days: -7 }],
  "soir.gateau": [
    { l: "Acompte", p: 30, from: "soir", days: -120 },
    { l: "Solde", p: 70, from: "soir", days: -2 },
  ],
  "soir.dj": [
    { l: "Acompte à la réservation", p: 30, from: "soir", days: -210 },
    { l: "Solde", p: 70, from: "soir", days: 0 },
  ],
  "soir.entree": [
    { l: "Acompte", p: 30, from: "soir", days: -180 },
    { l: "Solde", p: 70, from: "soir", days: 0 },
  ],
  "soir.live": [
    { l: "Acompte", p: 30, from: "soir", days: -180 },
    { l: "Solde", p: 70, from: "soir", days: 0 },
  ],
  "soir.ados": [
    { l: "Acompte", p: 30, from: "soir", days: -180 },
    { l: "Solde", p: 70, from: "soir", days: 0 },
  ],
  "soir.fleurs": [
    { l: "Acompte", p: 30, from: "soir", days: -150 },
    { l: "Solde", p: 70, from: "soir", days: -7 },
  ],
  "soir.sceno": [
    { l: "Acompte", p: 30, from: "soir", days: -150 },
    { l: "Solde", p: 70, from: "soir", days: -7 },
  ],
  "soir.photo2": [
    { l: "Acompte à la réservation", p: 30, from: "soir", days: -210 },
    { l: "2ᵉ acompte", p: 40, from: "soir", days: -90 },
    { l: "Solde", p: 30, from: "soir", days: 0 },
  ],
  "soir.film": [
    { l: "Acompte", p: 50, from: "soir", days: -90 },
    { l: "Solde", p: 50, from: "soir", days: -7 },
  ],
  "soir.papeterie": [
    { l: "Save-the-date", p: 40, from: "soir", days: -180 },
    { l: "Faire-part et menus", p: 60, from: "soir", days: -120 },
  ],
  "soir.rsvp": [{ l: "Nom de domaine / outil", p: 100, from: "soir", days: -150 }],
  "soir.cadeaux": [{ l: "Commande", p: 100, from: "soir", days: -45 }],
  "soir.tenues": [{ l: "Achats", p: 100, from: "soir", days: -45 }],
  "soir.logistique": [
    { l: "Acompte", p: 30, from: "soir", days: -120 },
    { l: "Solde", p: 70, from: "soir", days: 0 },
  ],
  "soir.assur": [{ l: "Souscription", p: 100, from: "soir", days: -210 }],
};

export function resolveDate(e: EventDates, from: RelPay["from"], days: number) {
  const base = from === "tef" ? e.tefilin : from === "shab" ? e.shabbat : e.party;
  if (!base) return "";
  return addDays(base, days);
}

export type PlanBlock = { key: string; title: string; subtitle: string; tasks: [string, string][] };

export function buildPlan(e: EventDates): PlanBlock[] {
  const child = e.child || "l’enfant";
  const tef = e.tefilin ? new Date(e.tefilin + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "tefilin";
  const shab = e.shabbat ? new Date(e.shabbat + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "montée à la Torah";
  const soir = e.party ? new Date(e.party + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "soirée";
  return [
    {
      key: "m18",
      title: "18 à 14 mois avant",
      subtitle: "Fondations",
      tasks: [
        ["Fixer l’enveloppe globale et la marge d’imprévus", "Budget"],
        ["Confirmer avec le rabbin les dates de tefilin et de paracha, kiddouch, alyot", "Synagogue"],
        [`Démarrer les cours de paracha, haftara et drasha avec ${child}`, ""],
        ["Récupérer le contrat de salle : montant, inclusions, horaires, traiteurs agréés", "Salle"],
        ["Liste d’invités v1 (famille / amis / amis de l’enfant)", ""],
        ["Consulter 3 traiteurs casher, demander devis et dates de dégustation", "Priorité"],
        ["Réserver photographe + vidéaste", "Priorité"],
        ["Réserver le DJ", "Priorité"],
      ],
    },
    {
      key: "m12",
      title: "13 à 10 mois avant",
      subtitle: "Prestataires clés",
      tasks: [
        ["Signer le traiteur et verser l’acompte", ""],
        ["Commander les tefilin chez un sofer (délai 3–4 mois)", ""],
        ["Choisir le talit, le sac brodé, les kippot", ""],
        ["Définir le thème de la soirée, briefer décorateur / fleuriste", ""],
        ["Réserver animation d’entrée, espace ados, musique du cocktail", ""],
        ["Souscrire l’assurance annulation", ""],
      ],
    },
    {
      key: "m8",
      title: "9 à 7 mois avant",
      subtitle: "Invitations",
      tasks: [
        ["Envoyer les save-the-date", ""],
        ["Dégustation traiteur, arrêter le menu", ""],
        ["Création des faire-part et du site RSVP", ""],
        ["Envoyer les faire-part (≈ 14 semaines avant la soirée)", ""],
        [`Rassembler photos et vidéos pour le film de ${child}`, ""],
      ],
    },
    {
      key: "m5",
      title: "6 à 4 mois avant",
      subtitle: "Détails",
      tasks: [
        ["Suivi des réponses RSVP, relances", ""],
        [`Tenues : ${child} et famille`, ""],
        ["Valider scénographie, fleurs, candy bar, gâteau", ""],
        ["Écrire la drasha avec le professeur", ""],
        ["Commander traiteur du petit-déj, du kiddouch et du déjeuner", ""],
      ],
    },
    {
      key: "m2",
      title: "3 à 2 mois avant",
      subtitle: "Dernière ligne droite",
      tasks: [
        ["Plan de table v1", ""],
        ["Playlist et moments clés avec le DJ (entrée, bougies, discours)", ""],
        ["Répétition à la synagogue", ""],
        ["Récupérer tefilin et talit, les faire vérifier", ""],
        ["Préparer les discours des parents", ""],
      ],
    },
    {
      key: "j",
      title: "Les temps forts",
      subtitle: "Jours J",
      tasks: [
        [`${tef} : pose des tefilin + petit-déjeuner`, "Jour J"],
        ["Veille de Shabbat : réception du déjeuner, mise en place", ""],
        [`${shab} : montée à la Torah, kiddouch, déjeuner familial`, "Jour J"],
        ["Nombre définitif d’invités au traiteur (≈ 10 jours avant la soirée)", ""],
        ["Plan de table final, rétroplanning horaire avec tous les prestataires", ""],
        ["Finaliser et tester le film projeté", ""],
        [`${soir} : soirée`, "Jour J"],
        ["Soldes des prestataires", ""],
        ["Mots de remerciement, partage des photos", ""],
      ],
    },
  ];
}

export function buildDays(e: EventDates) {
  const child = e.child || "l’enfant";
  return [
    {
      id: "tef",
      eyebrow: e.tefilin || "Tefilin",
      title: "Pose des tefilin",
      steps: [
        ["7h00", "Arrivée à la synagogue, accueil famille"],
        ["7h15", "Chaharit, pose des tefilin, lecture de la Torah"],
        ["8h15", "Photos avec les tefilin et le talit"],
        ["8h30", "Petit-déjeuner, mot du rabbin et des parents"],
        ["9h30", "Fin, chacun part travailler"],
      ],
      note: "À prévoir : photographe, traiteur livré à 7h45.",
    },
    {
      id: "shab",
      eyebrow: e.shabbat || "Shabbat",
      title: "Montée à la Torah",
      steps: [
        ["Veille", "Mise en place du déjeuner, plata, tables dressées"],
        ["9h00", `Office, ${child} lit sa paracha`],
        ["11h30", `Drasha de ${child}, bonbons`],
        ["12h00", "Kiddouch à la synagogue"],
        ["13h00", "Déjeuner familial"],
      ],
      note: "Pas de musique ni de photo : tout doit être prêt avant l’entrée de Shabbat.",
    },
    {
      id: "soir",
      eyebrow: e.party || "Soirée",
      title: "Soirée",
      steps: [
        ["15h00", "Installation déco, son, lumières"],
        ["19h30", "Accueil, cocktail avec musique live"],
        ["20h45", `Entrée de ${child} et de la famille`],
        ["21h00", "Dîner, film projeté, discours"],
        ["22h30", "Allumage des bougies, ouverture du bal"],
        ["23h00", "Soirée dansante, espace ados"],
        ["1h00", "Fin"],
      ],
      note: "Soirée en semaine : prévoir une fin raisonnable pour les invités qui travaillent le lendemain.",
    },
  ];
}

export const EVTAG: Record<string, string> = { tef: "Tefilin", shab: "Shabbat", soir: "Soirée" };
export const EVS = [
  ["tef", "Tefilin", "gTef"],
  ["dej", "Syna · déjeuner", "gDej"],
  ["soir", "Soirée", "guests"],
] as const;
export const FORMS: Record<string, string[]> = {
  all: ["tef", "dej", "soir"],
  soir: ["soir"],
  tef: ["tef"],
  "tef+soir": ["tef", "soir"],
  "tef+dej+soir": ["tef", "dej", "soir"],
};
