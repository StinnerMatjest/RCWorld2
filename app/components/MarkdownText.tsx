import React from "react";

// Renders a small subset of markdown: **bold**, *italic*, and lines starting with "- " as bullets.
// Safe (no dangerouslySetInnerHTML) and zero dependencies.

function parseInline(text: string): React.ReactNode {
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) parts.push(<strong key={match.index}>{match[1]}</strong>);
    else if (match[2] !== undefined) parts.push(<em key={match.index}>{match[2]}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return <>{parts}</>;
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let bullets: React.ReactNode[] = [];

  const flushBullets = (key: number) => {
    if (bullets.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="list-disc list-inside space-y-0.5 my-1">
        {bullets}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith("- ")) {
      bullets.push(<li key={i}>{parseInline(line.slice(2))}</li>);
    } else {
      flushBullets(i);
      if (line === "") {
        elements.push(<br key={i} />);
      } else {
        elements.push(<span key={i} className="block">{parseInline(line)}</span>);
      }
    }
  });
  flushBullets(lines.length);

  return <div className={className}>{elements}</div>;
}
