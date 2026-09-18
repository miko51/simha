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

export function normalizeChatHref(href: string): string {
  let h = href.trim().replace(/^<|>$/g, "").replace(/[),.;]+$/g, "");
  h = h.replace(/\s+/g, "");
  try {
    if (/^https?:\/\//i.test(h)) {
      const u = new URL(h);
      if (u.pathname.startsWith("/prestataires") || u.pathname.startsWith("/app") || u.pathname.startsWith("/login")) {
        return u.pathname + u.search;
      }
      return h;
    }
  } catch {
    /* ignore */
  }
  if (h.startsWith("/")) return h;
  if (h.startsWith("www.")) return "https://" + h;
  return h;
}

export function isSafeChatHref(href: string) {
  return /^(https?:\/\/|\/)/i.test(href) && !href.toLowerCase().startsWith("javascript:");
}

/** Recolle les liens markdown cassés sur plusieurs lignes et raccourcit les URLs Simha. */
export function repairChatMarkdown(text: string): string {
  let s = String(text || "").replace(/\r\n/g, "\n");
  s = s.replace(/\[([^\]]+)\]\(([\s\S]*?)\)/g, (_m, label: string, href: string) => {
    return `[${label.replace(/\s+/g, " ").trim()}](${normalizeChatHref(href)})`;
  });
  s = s.replace(/https?:\/\/[^\s<>\]]+/gi, (url) => normalizeChatHref(url));
  return s;
}

export function extractChatLinks(text: string): { label: string; href: string }[] {
  const repaired = repairChatMarkdown(text);
  const out: { label: string; href: string }[] = [];
  const seen = new Set<string>();
  const add = (label: string, href: string) => {
    const h = normalizeChatHref(href);
    if (!isSafeChatHref(h) || seen.has(h)) return;
    seen.add(h);
    out.push({ label: label.trim() || h, href: h });
  };
  const md = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = md.exec(repaired))) add(m[1], m[2]);
  const bare = /(\/prestataires\/[0-9a-f-]+|https?:\/\/[^\s)<]+)\/?/gi;
  while ((m = bare.exec(repaired))) {
    const href = normalizeChatHref(m[1]);
    if (!seen.has(href)) add(href.replace(/^https?:\/\/[^/]+/, "") || href, href);
  }
  return out;
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
