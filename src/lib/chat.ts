import type { VendorCategory } from "@/lib/types";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export function guessVendorCategories(question: string): VendorCategory[] {
  const t = question.toLowerCase();
  const found: VendorCategory[] = [];
  const add = (c: VendorCategory) => {
    if (!found.includes(c)) found.push(c);
  };
  if (/sofer|tefilin|talit|parchem/.test(t)) add("sofer");
  if (/traiteur|kiddouch|petit-d[ée]j|d[ée]jeuner|menu|casher.*repas|cocktail|boisson/.test(t)) add("traiteur");
  if (/salle|location|r[ée]ceptif|wedding hall/.test(t)) add("salle");
  if (/photo/.test(t)) add("photo");
  if (/vid[ée]o|film|teaser/.test(t)) add("video");
  if (/\bdj\b|sono|playlist|musique live|violon/.test(t)) add("dj");
  if (/anim|chaise|darbouk|ados|photobooth/.test(t)) add("animation");
  if (/fleur|bouquet|centre de table/.test(t)) add("fleuriste");
  if (/d[ée]co|sc[ée]no|mapping|lettres lumineu/.test(t)) add("deco");
  if (/g[âa]teau|pi[èe]ce mont|candy|p[aâ]tiss/.test(t)) add("gateau");
  if (/voiturier|vestiaire|nappage|logistique|s[ée]curit/.test(t)) add("logistique");
  return found;
}

export function groupMessagesByDay(msgs: ChatMessage[]) {
  const groups: { label: string; items: ChatMessage[] }[] = [];
  for (const m of msgs) {
    const d = m.created_at ? new Date(m.created_at) : new Date();
    const label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [m] });
    else last.items.push(m);
  }
  return groups;
}
