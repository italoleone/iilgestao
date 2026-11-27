// Mention tokens shared by the chat UI and edge functions (pure, no imports).
export type Mention = { type: "p" | "u"; id: string; name: string };
export const MENTION_RE = /@\[(p|u):([0-9a-fA-F-]{36})\|([^\]|]*)\]/g;
const clean = (name: string) => name.replace(/[|\]\[]/g, " ").replace(/\s+/g, " ").trim();
export function mentionToken(type: "p" | "u", id: string, name: string) { return `@[${type}:${id}|${clean(name)}]`; }
export function extractMentions(text: string): Mention[] {
  return [...text.matchAll(MENTION_RE)].map(m => ({ type: m[1] as "p" | "u", id: m[2].toLowerCase(), name: m[3] }));
}
/** Replaces tokens by "@Nome" (or plain name with prefix=false). */
export function mentionsToPlain(text: string, prefix = true) { return text.replace(MENTION_RE, (_, _t, _id, name) => `${prefix ? "@" : ""}${name}`); }
/** Text without any token, whitespace collapsed. */
export function stripMentions(text: string) { return text.replace(MENTION_RE, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim(); }
/** Keeps mentioned names; only people at the sentence boundaries are recipients. */
export function pedidoDescription(text: string) {
  const person = "@\\[u:[0-9a-fA-F-]{36}\\|[^\\]|]*\\]";
  let out = text.trim();
  const leading = new RegExp(`^${person}[\\s,;:]*`);
  const trailing = new RegExp(`[\\s,;:]*${person}[.!?]?\\s*$`);
  while (leading.test(out)) out = out.replace(leading, "");
  while (trailing.test(out)) out = out.replace(trailing, "");
  return mentionsToPlain(out, false).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}
export function splitMentions(text: string): (string | Mention)[] {
  const out: (string | Mention)[] = []; let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ type: m[1] as "p" | "u", id: m[2].toLowerCase(), name: m[3] }); last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
/** Converts the readable draft ("@Nome") into tokens using the picks made in the popover. */
export function encodeDraft(draft: string, picks: Mention[]) {
  let out = draft;
  for (const p of [...picks].sort((a, b) => b.name.length - a.name.length)) {
    const label = `@${clean(p.name)}`; const at = out.indexOf(label);
    if (at >= 0) out = out.slice(0, at) + mentionToken(p.type, p.id, p.name) + out.slice(at + label.length);
  }
  return out;
}
/** A message is a request when it has exactly one distinct project and 1–3 distinct people. */
export function isPedido(text: string) {
  const ms = extractMentions(text);
  const projects = new Set(ms.filter(m => m.type === "p").map(m => m.id));
  const people = new Set(ms.filter(m => m.type === "u").map(m => m.id));
  return projects.size === 1 && people.size >= 1 && people.size <= 3;
}
