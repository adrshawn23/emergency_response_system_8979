/**
 * Purges accumulated E2E/test data from Supabase.
 *
 * Deletes (subject to RLS):
 *  - Departments created by tests: "Test Medical Department", "QA *", "E2E *"
 *  - Incidents created by tests: "E2E workflow incident *", "Test incident *",
 *    "SYSTEM TEST *", "SYNTHETIC STAGING TEST *", keyboard-mash entries
 *
 * Reports are only deletable by their reporter (residents_manage_own_reports),
 * so the script signs in as each known test account and deletes what it owns.
 * Rows owned by unknown accounts are listed at the end for manual SQL cleanup.
 *
 * Run: node scripts/cleanup-test-data.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const TEST_DEPT_PATTERNS = [/^Test Medical Department$/i, /^QA\s/i, /^E2E\b/i];
const TEST_REPORT_PATTERNS = [
  /^E2E workflow incident/i,
  /^Test incident/i,
  /^SYSTEM TEST/i,
  /^SYNTHETIC STAGING TEST/i,
  /^(sadadad|asdasda|sadasdasdasd|sdfsdfsgfdhjg)$/i,
];

const ACCOUNTS = [
  { email: 'admin@emergency.gov', password: 'admin123' },
  { email: 'dispatcher@emergency.gov', password: 'dispatcher123' },
  { email: 'resident@example.com', password: 'resident123' },
];

const isTestDept = (name) => TEST_DEPT_PATTERNS.some((p) => p.test(name || ''));
const isTestReport = (content) => TEST_REPORT_PATTERNS.some((p) => p.test((content || '').trim()));

async function signIn(email, password) {
  await sb.auth.signOut();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  const { data } = await sb.auth.getUser();
  return data.user.id;
}

async function main() {
  // --- Departments: admin policy is FOR ALL, so one admin session is enough ---
  const adminId = await signIn(ACCOUNTS[0].email, ACCOUNTS[0].password);
  console.log(`signed in admin ${adminId.slice(0, 8)}`);

  const { data: depts } = await sb.from('departments').select('id, name').order('created_at');
  const testDepts = (depts || []).filter((d) => isTestDept(d.name));
  console.log(`departments: ${depts.length} total, ${testDepts.length} test-created`);

  for (const d of testDepts) {
    const { error } = await sb.from('departments').delete().eq('id', d.id);
    console.log(`  dept ${d.name} (${d.id.slice(0, 8)}): ${error ? 'FAILED ' + error.message : 'deleted'}`);
  }

  // --- Reports: each reporter can only delete its own rows ---
  const { data: reports } = await sb
    .from('emergency_reports')
    .select('id, report_id, content, reporter_id')
    .order('created_at');
  const testReports = (reports || []).filter((r) => isTestReport(r.content));
  console.log(`reports: ${reports.length} total, ${testReports.length} test-created`);

  const deleted = new Set();
  for (const acct of ACCOUNTS) {
    const uid = await signIn(acct.email, acct.password);
    const mine = testReports.filter((r) => r.reporter_id === uid);
    for (const r of mine) {
      const { error } = await sb.from('emergency_reports').delete().eq('id', r.id);
      console.log(`  ${r.report_id} (${acct.email}): ${error ? 'FAILED ' + error.message : 'deleted'}`);
      if (!error) deleted.add(r.id);
    }
  }

  const orphans = testReports.filter((r) => !deleted.has(r.id));
  if (orphans.length) {
    console.log('\ncould not delete (owned by unknown/other accounts) — remove via SQL editor:');
    orphans.forEach((r) => console.log(`  ${r.report_id} "${(r.content || '').slice(0, 40)}" reporter=${r.reporter_id}`));
    console.log("  DELETE FROM public.emergency_reports WHERE id IN (" +
      orphans.map((r) => `'${r.id}'`).join(', ') + ');');
  }
  console.log('\ndone.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
