import type { ReactNode } from "react";
import Link from "next/link";

function isSafeHref(href: string) {
  return /^(https?:\/\/|\/)/i.test(href) && !href.toLowerCase().startsWith("javascript:");
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] && m[3] && isSafeHref(m[3].trim())) {
      const href = m[3].trim();
      const internal = href.startsWith("/");
      out.push(
        internal ? (
          <Link key={`${keyPrefix}-a-${i}`} href={href} className="chat-link">
            {m[2]}
          </Link>
        ) : (
          <a key={`${keyPrefix}-a-${i}`} href={href} target="_blank" rel="noreferrer" className="chat-link">
            {m[2]}
          </a>
        ),
      );
    } else if (m[4]) {
      out.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold">
          {m[4]}
        </strong>,
      );
    } else {
      out.push(m[0]);
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function MarkdownMessage({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="text-sm leading-relaxed">
      {blocks.map((line, i) => {
        const bullet = line.match(/^\s*[-•]\s+(.*)$/);
        const content = bullet ? bullet[1] : line;
        if (!content && i < blocks.length - 1) return <div key={i} className="h-2" />;
        return (
          <p key={i} className={bullet ? "pl-3 relative before:content-['•'] before:absolute before:left-0" : ""}>
            {renderInline(content, String(i))}
          </p>
        );
      })}
    </div>
  );
}
