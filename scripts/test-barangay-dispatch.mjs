// Barangay response-group sanity test — run: node --env-file=.env scripts/test-barangay-dispatch.mjs
// Verifies the new model live:
//   1) only the 3 barangay groups are active departments
//   2) accident -> Health & First Aid assigned -> auto-CDA to Barangay Tanod
//   3) Tanod responder sees the pending request (RLS) and accepts it
//   4) flood -> DRT assigned -> NO assisting requests (single-group incident)
// Probe reports are deleted afterwards (CDA rows cascade).

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.log('SKIP  no Supabase env vars'); process.exit(1); }

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
};

const TAG = `barangay-probe-${Date.now()}`;
async function signIn(email, password) {
  const sb = createClient(url, key);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  const { data: me } = await sb.auth.getUser();
  return { sb, user: me.user };
}

const dispatcher = await signIn('dispatcher@emergency.gov', 'dispatcher123');
const tanod     = await signIn('barangaytanodpeaceandorder.responder1@emergency.gov', 'responder123');

// --- departments ----------------------------------------------------------
const { data: depts } = await dispatcher.sb
  .from('departments').select('id, name, type, status');
const active = (depts || []).filter(d => (d.status ?? 'active') === 'active');
const byName = n => depts?.find(d => d.name === n);
const drt = byName('Disaster Response Team (BDRRMC)');
const tnd = byName('Barangay Tanod / Peace and Order');
const hfa = byName('Health and First Aid Team');

check('3 barangay groups active', active.length === 3 && !!drt && !!tnd && !!hfa,
  `active: ${active.map(d => d.name).join(' | ') || 'none'}`);
if (!drt || !tnd || !hfa) { console.log('missing depts — abort'); process.exit(1); }

const created = [];

// --- scenario A: accident -> Health main, auto-CDA -> Tanod ---------------
const { data: rA, error: eA } = await dispatcher.sb
  .from('emergency_reports')
  .insert({
    reporter_id: dispatcher.user.id,
    report_type: 'accident',
    content: `${TAG} road accident`,
    attachments: { location: `${TAG} — test coords`, contact_name: 'Probe' },
    priority: 'medium',
  })
  .select('id').single();
check('accident report inserts', !eA, eA?.message);
if (eA) process.exit(1);
created.push(rA.id);

const { error: eAsg } = await dispatcher.sb
  .from('emergency_reports')
  .update({ status: 'assigned', assigned_department_id: hfa.id })
  .eq('id', rA.id);
check('assign to Health & First Aid', !eAsg, eAsg?.message);

const { data: cdaA } = await dispatcher.sb
  .from('cross_department_assistance')
  .select('id, assisting_department_id, status, notes')
  .eq('report_id', rA.id);
const toTanod = (cdaA || []).find(c => c.assisting_department_id === tnd.id);
check('auto-CDA created to Barangay Tanod', !!toTanod && toTanod.status === 'pending',
  JSON.stringify(cdaA));

// --- Tanod responder sees it (RLS) and accepts -----------------------------
const { data: seen } = await tanod.sb
  .from('cross_department_assistance')
  .select('id, status')
  .eq('report_id', rA.id)
  .eq('assisting_department_id', tnd.id);
check('tanod responder sees pending request', seen?.length === 1 && seen[0].status === 'pending',
  JSON.stringify(seen));

const { error: eAcc } = await tanod.sb
  .from('cross_department_assistance')
  .update({ status: 'accepted', responded_by: tanod.user.id, updated_at: new Date().toISOString() })
  .eq('id', toTanod.id);
check('tanod responder accepts request', !eAcc, eAcc?.message);

// --- scenario B: flood -> DRT main, NO auto-assists ------------------------
const { data: rB, error: eB } = await dispatcher.sb
  .from('emergency_reports')
  .insert({
    reporter_id: dispatcher.user.id,
    report_type: 'flood',
    content: `${TAG} flood`,
    attachments: { location: `${TAG} — test coords`, contact_name: 'Probe' },
    priority: 'medium',
  })
  .select('id').single();
check('flood report inserts', !eB, eB?.message);
if (rB) created.push(rB.id);

if (rB) {
  const { error: eBsg } = await dispatcher.sb
    .from('emergency_reports')
    .update({ status: 'assigned', assigned_department_id: drt.id })
    .eq('id', rB.id);
  check('assign to Disaster Response Team', !eBsg, eBsg?.message);

  const { data: cdaB } = await dispatcher.sb
    .from('cross_department_assistance')
    .select('id, assisting_department_id')
    .eq('report_id', rB.id);
  check('flood creates no assisting requests', (cdaB || []).length === 0,
    `${(cdaB || []).length} row(s)`);
}

// --- cleanup ---------------------------------------------------------------
for (const id of created) {
  const { error } = await dispatcher.sb.from('emergency_reports').delete().eq('id', id);
  if (error) console.warn(`cleanup: could not delete ${id}: ${error.message}`);
}
await dispatcher.sb.auth.signOut();
await tanod.sb.auth.signOut();

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
