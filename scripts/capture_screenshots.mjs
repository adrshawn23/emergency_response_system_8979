// Captures Kalubihan ERS screenshots for the appendix.
// Usage:
//   node scripts/capture_screenshots.mjs                 -> public pages only
//   node scripts/capture_screenshots.mjs email pass      -> logs in, captures role pages too
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:4190';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const publicOnly = process.argv[2] === 'public';

const PUBLIC_PAGES = [
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/forgot-password', name: 'forgot-password' },
  { path: '/suspended-preview', name: 'suspended' },
];

// Seed test accounts from MANUAL_TESTING.md
const ACCOUNTS = [
  { role: 'admin', email: 'admin@emergency.gov', password: 'admin123' },
  { role: 'dispatcher', email: 'dispatcher@emergency.gov', password: 'dispatcher123' },
  { role: 'deptadmin', email: 'deptadmin.fire@emergency.gov', password: 'deptadmin123' },
  { role: 'responder', email: 'responder@emergency.gov', password: 'responder123' },
  { role: 'resident', email: 'resident@example.com', password: 'resident123' },
];

// mobile:true = also captured at phone width
const ROLE_PAGES = [
  { path: '/', name: 'home', mobile: true },
  { path: '/report-management', name: 'incident-queue', mobile: true },
  { path: '/emergency-report', name: 'new-incident', mobile: true },
  { path: '/department-management', name: 'departments' },
  { path: '/user-management', name: 'residents-review' },
  { path: '/access-control', name: 'access-control' },
  { path: '/reports', name: 'reports' },
  { path: '/announcements', name: 'announcements', mobile: true },
  { path: '/contacts', name: 'contacts' },
  { path: '/profile', name: 'profile' },
  { path: '/notifications', name: 'notifications' },
];

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
];

const browser = await chromium.launch();
let shot = 0;

async function snap(page, name) {
  await page.waitForTimeout(1200); // let data/maps settle
  const file = `${OUT}/${String(++shot).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
}

async function login(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile || false,
    hasTouch: vp.hasTouch || false,
  });
  const page = await ctx.newPage();

  for (const p of PUBLIC_PAGES) {
    await page.goto(BASE + p.path, { waitUntil: 'networkidle' }).catch(() => {});
    await snap(page, `${p.name}-${vp.label}`);
  }
  await ctx.close();
}

if (!publicOnly) {
  for (const acct of ACCOUNTS) {
    const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const dpage = await dctx.newPage();
    await login(dpage, acct.email, acct.password);
    if (dpage.url().includes('/login')) { console.log('LOGIN FAILED:', acct.role); await dctx.close(); continue; }

    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mpage = await mctx.newPage();
    await login(mpage, acct.email, acct.password);

    for (const p of ROLE_PAGES) {
      await dpage.goto(BASE + p.path, { waitUntil: 'networkidle' }).catch(() => {});
      await dpage.waitForTimeout(1500); // client-side RoleRoute bounce needs a beat
      // No access -> RoleRoute navigates back to '/', so URL won't match
      const landed = new URL(dpage.url()).pathname;
      const body = await dpage.textContent('body').catch(() => '');
      if (/loading permissions/i.test(body || '') || (landed !== p.path && !(p.path === '/' && landed === '/'))) {
        console.log('skipped (no access):', acct.role, p.path, '->', landed);
        continue;
      }
      await snap(dpage, `${acct.role}-${p.name}-desktop`);

      if (p.mobile) {
        await mpage.goto(BASE + p.path, { waitUntil: 'networkidle' }).catch(() => {});
        await mpage.waitForTimeout(800);
        await snap(mpage, `${acct.role}-${p.name}-mobile`);
      }
    }
    await dctx.close();
    await mctx.close();
  }
}

await browser.close();
console.log('done');
