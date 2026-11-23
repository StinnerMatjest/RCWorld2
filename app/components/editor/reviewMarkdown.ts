/**
 * The review editor writes straight on the page, in a contenteditable, while
 * the site stores the small markdown set MarkdownText renders: lines, "- "
 * bullet lines, **bold**, *italic* and ||spoiler||. These two functions carry
 * the text between the two forms, and nothing else is allowed through.
 */

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The class the editor's inline spoiler span wears (a solid bar, as readers see it). */
export const SPOILER_CLASS = "rounded px-0.5 bg-slate-700/80 text-slate-200 ring-1 ring-red-900/50";

function inlineToHtml(text: string): string {
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|\|\|(.+?)\|\|/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    if (m[1] !== undefined) out += `<b>${escapeHtml(m[1])}</b>`;
    else if (m[2] !== undefined) out += `<i>${escapeHtml(m[2])}</i>`;
    else out += `<span data-spoiler="1" class="${SPOILER_CLASS}">${escapeHtml(m[3])}</span>`;
    last = regex.lastIndex;
  }
  return out + escapeHtml(text.slice(last));
}

/** Markdown -> the HTML the contenteditable starts from. Every line is a block, bullets a list. */
export function markdownToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => { if (bullets.length) { out.push(`<ul>${bullets.join("")}</ul>`); bullets = []; } };
  for (const line of lines) {
    if (line.startsWith("- ")) { bullets.push(`<li>${inlineToHtml(line.slice(2))}</li>`); continue; }
    flush();
    out.push(line === "" ? "<div><br></div>" : `<div>${inlineToHtml(line)}</div>`);
  }
  flush();
  return out.join("");
}

function inlineOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/ /g, " ");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return "\n";
  const inner = Array.from(el.childNodes).map(inlineOf).join("");
  if (!inner.trim()) return inner;
  const bold = tag === "b" || tag === "strong" || /^(bold|[6-9]00)$/.test(el.style.fontWeight);
  const italic = tag === "i" || tag === "em" || el.style.fontStyle === "italic";
  const mark = el.dataset.spoiler ? "||" : bold ? "**" : italic ? "*" : "";
  if (!mark) return inner;
  // A selection that took a space along: the space stays outside the marks.
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

const BLOCK = new Set(["div", "p", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "pre"]);

/** The contenteditable's HTML -> markdown. Blocks become lines, list items "- " lines. */
export function htmlToMarkdown(root: HTMLElement): string {
  const lines: string[] = [];
  let run = ""; // inline content gathered before the next block
  const endRun = () => { if (run !== "") { lines.push(...run.split("\n")); run = ""; } };
  const walk = (node: Node, inList: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) { run += inlineOf(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") { endRun(); Array.from(el.childNodes).forEach(c => walk(c, true)); return; }
    if (tag === "li") {
      endRun();
      const text = Array.from(el.childNodes).map(inlineOf).join("").replace(/\n+$/, "");
      lines.push(...text.split("\n").map((l, i) => (i === 0 ? `- ${l}` : l)));
      return;
    }
    if (BLOCK.has(tag)) {
      endRun();
      const hasBlockChild = Array.from(el.children).some(c => BLOCK.has(c.tagName.toLowerCase()));
      if (hasBlockChild) { Array.from(el.childNodes).forEach(c => walk(c, inList)); endRun(); return; }
      const text = Array.from(el.childNodes).map(inlineOf).join("");
      // A block holding only a <br> is an empty line; a trailing <br> is Chrome's, not a line.
      lines.push(...text.replace(/\n$/, "").split("\n"));
      return;
    }
    run += inlineOf(el);
  };
  Array.from(root.childNodes).forEach(c => walk(c, false));
  endRun();
  return lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
}
