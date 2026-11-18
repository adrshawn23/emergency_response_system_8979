// Renders the diagram figures inside the manuscript HTML docs into PNGs that
// the defense deck shows as crisp, scrollbar-free images (build-deck.mjs then
// embeds them in the standalone file).
// Run: node scripts/render-diagrams.mjs

import { chromium } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'screenshots');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });

const snap = async (file, sel, out, idx = 0) => {
  await page.goto(pathToFileURL(join(root, file)).href);
  const loc = page.locator(sel).nth(idx);
  await loc.waitFor();
  await loc.screenshot({ path: join(outDir, out) });
  console.log('wrote screenshots/' + out);
};

// single-figure docs
await snap('fdd.html', '#tree svg', 'diagram-fdd.png');
await snap('erd.html', '#erd svg', 'diagram-erd.png');
await snap('gantt_chart.html', '#g', 'diagram-gantt.png');

// use_case_diagrams.html — one figure per actor (Admin, Resident, Dispatcher, Responder, Dept Admin)
for (const [i, name] of ['admin', 'resident', 'dispatcher', 'responder', 'deptadmin'].entries()) {
  await snap('use_case_diagrams.html', '.figwrap svg', `diagram-uc-${name}.png`, i);
}

// network_design.html — model, topology, technology stack diagrams
for (const [i, name] of ['model', 'topology', 'stack'].entries()) {
  await snap('network_design.html', 'svg', `diagram-net-${name}.png`, i);
}

await browser.close();
console.log('done — 11 diagram PNGs in screenshots/');
