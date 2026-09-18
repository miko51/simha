"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useChat } from "@/components/chat/ChatProvider";
import RabbiAvatar from "@/components/chat/RabbiAvatar";
import MarkdownMessage from "@/components/chat/MarkdownMessage";

const QUICK = [
  "Quelle paracha pour notre Shabbat ?",
  "Un traiteur casher près de nous ?",
  "Photographe pour la pose des tefilin ?",
  "Cette date tombe-t-elle dans l’Omer ?",
];

export default function RabbiChat() {
  const { open, setOpen, busy, messages, send, loggedIn, eventId, notice } = useChat();
  const path = usePathname();
  const [input, setInput] = useState("");
  const [peek, setPeek] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem("simha:rav-hello")) setPeek(true);
    } catch {
      setPeek(true);
    }
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  function openChat() {
    setOpen(true);
    setPeek(false);
    try {
      localStorage.setItem("simha:rav-hello", "1");
    } catch {
      /* ignore */
    }
  }

  async function submit(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    await send(q);
  }

  const historyHref = eventId ? `/app/${eventId}` : "/app";

  return (
    <>
      {!open && peek && path !== "/login" && (
        <button type="button" className="rav-peek" onClick={openChat}>
          Shalom ! Une question sur la simha ?
        </button>
      )}
      {!open && (
        <button type="button" className="rav-fab" onClick={openChat} aria-label="Ouvrir le chat avec Rav Simha">
          <span className="rav-fab-ring" aria-hidden />
          <RabbiAvatar size={64} decorative />
        </button>
      )}
      {open && (
        <section className="rav-panel" aria-label="Chat Rav Simha">
          <header className="rav-head">
            <RabbiAvatar size={48} />
            <div className="min-w-0">
              <p className="font-serif text-lg leading-tight">Rav Simha</p>
              <p className="text-xs opacity-80">Petit rav de poche · calendrier, budget, prestataires</p>
            </div>
            <button type="button" className="rav-close" onClick={() => setOpen(false)} aria-label="Fermer le chat">
              ×
            </button>
          </header>
          <div ref={scroller} className="rav-body">
            {messages.length === 0 && (
              <div className="rav-welcome">
                <RabbiAvatar size={72} />
                <p className="font-serif text-xl mt-2">Shalom !</p>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Je suis le petit Rav. Paracha, Omer, kiddouch, DJ, sofer… je t’oriente — et je te glisse un lien de l’annuaire quand ça aide.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {QUICK.map((q) => (
                    <button key={q} type="button" className="rav-chip" onClick={() => void submit(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id || i} className={`rav-msg ${m.role === "user" ? "mine" : "rav"}`}>
                {m.role !== "user" && <RabbiAvatar size={32} decorative />}
                <div className="rav-bubble">
                  {m.role === "user" ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p> : <MarkdownMessage text={m.content} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="rav-msg rav">
                <RabbiAvatar size={32} decorative className="rav-nod" />
                <div className="rav-bubble rav-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {notice && <p className="text-xs text-[var(--muted)] px-1">{notice}</p>}
            {!loggedIn && (
              <p className="text-xs text-[var(--muted)] px-1">
                <Link href="/login?role=family" className="text-[var(--tekhelet)] font-semibold">
                  Connecte-toi
                </Link>{" "}
                pour garder l’historique sur la page Assistant.
              </p>
            )}
          </div>
          <form
            className="rav-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="Demande au petit Rav…"
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy || !input.trim()}>
              Envoyer
            </button>
          </form>
          {eventId && (
            <p className="rav-foot">
              Historique complet dans l’onglet Assistant de{" "}
              <Link href={historyHref} className="text-[var(--gold)] font-semibold">
                l’événement
              </Link>
              .
            </p>
          )}
        </section>
      )}
    </>
  );
}
