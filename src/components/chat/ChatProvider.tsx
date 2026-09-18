"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/chat";

type ChatCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  busy: boolean;
  messages: ChatMessage[];
  eventId: string | null;
  loggedIn: boolean;
  send: (text: string) => Promise<void>;
  notice: string | null;
};

const Ctx = createContext<ChatCtx | null>(null);
const EVENT_KEY = "simha:eventId";

export function useChat() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChat hors ChatProvider");
  return v;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const sb = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const m = path.match(/^\/app\/([0-9a-f-]{36})/i);
    if (m?.[1]) {
      setEventId(m[1]);
      try {
        localStorage.setItem(EVENT_KEY, m[1]);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const stored = localStorage.getItem(EVENT_KEY);
      if (stored) setEventId(stored);
    } catch {
      /* ignore */
    }
  }, [path]);

  const load = useCallback(async () => {
    const { data: u } = await sb.auth.getUser();
    setLoggedIn(!!u.user);
    if (!u.user) {
      try {
        const raw = sessionStorage.getItem("simha:guest-chat");
        setMessages(raw ? (JSON.parse(raw) as ChatMessage[]) : []);
      } catch {
        setMessages([]);
      }
      return;
    }
    let q = sb.from("ai_messages").select("id,role,content,created_at").order("created_at", { ascending: true }).limit(400);
    q = eventId ? q.eq("event_id", eventId) : q.is("event_id", null).eq("user_id", u.user.id);
    const { data } = await q;
    setMessages(
      ((data || []) as ChatMessage[]).filter((m) => m.role === "user" || m.role === "assistant"),
    );
  }, [eventId, sb]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const userMsg: ChatMessage = { role: "user", content: q, created_at: new Date().toISOString() };
      setMessages((m) => [...m, userMsg]);
      setBusy(true);
      setNotice(null);
      try {
        const r = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId, message: q }),
        });
        const j = await r.json();
        const reply = String(j.reply || j.error || "Pas de réponse.");
        if (j.notice) setNotice(j.notice);
        const { data: u } = await sb.auth.getUser();
        if (u.user) {
          setLoggedIn(true);
          await load();
          setMessages((m) => {
            if (m.some((x) => x.role === "assistant" && x.content === reply)) return m;
            return [...m, { role: "assistant", content: reply, created_at: new Date().toISOString() }];
          });
        } else {
          setMessages((m) => {
            const next: ChatMessage[] = [...m, { role: "assistant", content: reply, created_at: new Date().toISOString() }];
            try {
              sessionStorage.setItem("simha:guest-chat", JSON.stringify(next.slice(-20)));
            } catch {
              /* ignore */
            }
            return next;
          });
        }
      } catch {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Oups, le petit Rav a perdu sa connexion. Réessaie dans un instant.", created_at: new Date().toISOString() },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, eventId, load, sb],
  );

  const value = useMemo(
    () => ({ open, setOpen, busy, messages, eventId, loggedIn, send, notice }),
    [open, busy, messages, eventId, loggedIn, send, notice],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
