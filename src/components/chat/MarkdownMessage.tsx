import type { ReactNode } from "react";
import { extractChatLinks, isSafeChatHref, normalizeChatHref, repairChatMarkdown } from "@/lib/chat";

function ChatAnchor({ href, children }: { href: string; children: ReactNode }) {
  const h = normalizeChatHref(href);
  if (!isSafeChatHref(h)) return <>{children}</>;
  const external = /^https?:\/\//i.test(h);
  return (
    <a href={h} className="chat-link" {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
    </a>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|https?:\/\/[^\s)<]+|\/prestataires\/[0-9a-f-]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] && m[3]) {
      out.push(
        <ChatAnchor key={`${keyPrefix}-a-${i}`} href={m[3]}>
          {m[2]}
        </ChatAnchor>,
      );
    } else if (m[4]) {
      out.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold">
          {m[4]}
        </strong>,
      );
    } else {
      const href = m[0];
      const label = href.startsWith("/prestataires/") ? "Voir la fiche" : href.replace(/^https?:\/\/[^/]+/, "") || href;
      out.push(
        <ChatAnchor key={`${keyPrefix}-u-${i}`} href={href}>
          {label}
        </ChatAnchor>,
      );
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function MarkdownMessage({ text }: { text: string }) {
  const repaired = repairChatMarkdown(text);
  const links = extractChatLinks(repaired);
  const blocks = repaired.split("\n");
  return (
    <div className="text-sm leading-relaxed">
      {blocks.map((line, i) => {
        const bullet = line.match(/^\s*(?:[-•]|\d+[.)])\s+(.*)$/);
        const content = bullet ? bullet[1] : line;
        if (!content && i < blocks.length - 1) return <div key={i} className="h-2" />;
        return (
          <p key={i} className={bullet ? "pl-3 relative before:content-['•'] before:absolute before:left-0" : ""}>
            {renderInline(content, String(i))}
          </p>
        );
      })}
      {links.length > 0 && (
        <div className="chat-link-row">
          {links.map((l) => {
            const h = normalizeChatHref(l.href);
            if (!isSafeChatHref(h)) return null;
            const external = /^https?:\/\//i.test(h);
            return (
              <a key={h} href={h} className="chat-link-btn" {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
                {l.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
