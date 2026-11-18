// Builds defense_presentation_standalone.html — the defense deck with every
// iframe'd diagram page (fdd/use_case/erd/network/gantt) embedded inline, so
// the single output file works on any device without the sibling .html files.
// Re-run after editing defense_presentation.html or any diagram page:
//   node scripts/build-deck.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deckPath = join(root, 'defense_presentation.html');
let deck = readFileSync(deckPath, 'utf8');

const docs = new Map(); // src -> template id
const tplId = n => 'doc' + n;

// iframe src="X.html"  ->  iframe data-doc="docN"   (srcdoc filled at runtime)
deck = deck.replace(/<iframe\s+src="([^"]+\.html)"/g, (m, src) => {
  if (!docs.has(src)) docs.set(src, tplId(docs.size));
  return `<iframe data-doc="${docs.get(src)}"`;
});

// "open full page" links -> open a blob built from the embedded template
deck = deck.replace(/<a class="open" href="([^"]+\.html)"([^>]*)>/g, (m, src, rest) => {
  const id = docs.get(src) ?? tplId(docs.size);
  if (!docs.has(src)) docs.set(src, id);
  return `<a class="open" data-doc="${id}" href="#"${rest.replace(/target="_blank"/, '')}>`;
});

// Embed each referenced document inside a <template> (styles stay scoped to
// the iframe — no leakage into the deck).
const templates = [...docs.entries()].map(([src, id]) => {
  const content = readFileSync(join(root, src), 'utf8');
  return `<template id="${id}">\n${content}\n</template>`;
}).join('\n');

const runtime = `<script>
// Standalone mode: fill iframes from embedded <template> docs.
document.querySelectorAll('iframe[data-doc]').forEach(f => {
  const t = document.getElementById(f.dataset.doc);
  if (t) f.srcdoc = '<!DOCTYPE html>' + t.innerHTML;
});
document.querySelectorAll('a.open[data-doc]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.getElementById(a.dataset.doc);
    if (t) window.open(URL.createObjectURL(new Blob(
      ['<!DOCTYPE html>' + t.innerHTML], { type: 'text/html' })), '_blank');
  });
});
</scr` + `ipt>`;

// Inline screenshot images used by the walkthrough as base64 data URIs so the
// standalone file doesn't depend on the screenshots/ folder.
deck = deck.replace(/screenshots\/[\w.-]+\.png/g, rel => {
  const buf = readFileSync(join(root, rel));
  return 'data:image/png;base64,' + buf.toString('base64');
});

deck = deck.replace('</body>', `${templates}\n${runtime}\n</body>`);
const out = join(root, 'defense_presentation_standalone.html');
writeFileSync(out, deck);
console.log(`wrote ${out} (${Math.round(deck.length / 1024)} KB, embedded ${docs.size} docs)`);
