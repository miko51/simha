export type ProfileRole = "family" | "vendor" | "admin";
export type EventKind = "bar" | "bat";
export type Minhag = "sepharade" | "ashkenaze" | "autre";
export type MemberRole = "owner" | "editor" | "viewer";
export type LineStatus = "todo" | "devis" | "reserve" | "paye" | "vire";
export type Rsvp = "" | "att" | "oui" | "non";
export type VendorCategory =
  | "salle"
  | "traiteur"
  | "dj"
  | "deco"
  | "fleuriste"
  | "photo"
  | "video"
  | "animation"
  | "gateau"
  | "logistique";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
};

export type EventRow = {
  id: string;
  created_by: string;
  child_first_name: string;
  child_last_name: string | null;
  kind: EventKind;
  minhag: Minhag;
  birth_date: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  synagogue_id: string | null;
  date_tefilin: string | null;
  date_shabbat: string | null;
  date_party: string | null;
  budget_envelope: number | null;
  guests: number;
  g_tef: number;
  g_kid: number;
  g_dej: number;
  kosher: "casher" | "casher_glatt" | "flexible" | null;
};

export type Synagogue = {
  id: string;
  name: string;
  rite: string;
  address: string | null;
  city: string;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: string;
};

export type Hall = {
  id: string;
  synagogue_id: string;
  name: string;
  capacity: number;
  usage: string;
  accessible: boolean;
  equipment: string | null;
};

export type Vendor = {
  id: string;
  user_id: string;
  name: string;
  categories: string[];
  city: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  kasherut: string | null;
  price_min: number | null;
  price_max: number | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  photos: string[];
  moderated: boolean;
};

export type GuestData = {
  nom: string;
  groupe: string;
  n: Record<string, number>;
  inv: Record<string, Rsvp>;
  table: string;
  note: string;
  created: number;
};

export type BudgetLine = { u: number; q: number | null; st: LineStatus };
export type BudgetState = {
  guests: number;
  gTef: number;
  gKid: number;
  gDej: number;
  cont: number;
  lines: Record<string, BudgetLine>;
  custom?: { groups: { id: string; title: string; when: string }[]; items: { id: string; g: string; label: string; qk: string; u: number }[] };
  layout?: Record<string, string[]>;
};

export type PayItem = { id: string; l: string; p: number; d: string; ok: boolean };
export type PayState = Record<string, PayItem[]>;
export type TaskState = Record<string, boolean>;

export const VENDOR_LABELS: Record<VendorCategory, string> = {
  salle: "Salle",
  traiteur: "Traiteur",
  dj: "DJ / sono",
  deco: "Décoration",
  fleuriste: "Fleuriste",
  photo: "Photographe",
  video: "Vidéaste",
  animation: "Animation",
  gateau: "Pièce montée",
  logistique: "Logistique",
};

export const GUEST_GROUPS = [
  "Famille paternelle",
  "Famille maternelle",
  "Amis des parents",
  "Amis de l’enfant",
  "Communauté / syna",
  "Travail",
  "Autre",
];
