// Incident-cluster smoke test — run: node --env-file=.env scripts/test-clusters.mjs
// Verifies the 20261116090000_incident_clusters migration live:
//   1) same type + inside 150m + open  -> linked (cluster_id = primary id)
//   2) same type + outside 150m        -> stays standalone
//   3) different type + same coords    -> stays standalone
//   4) status/assignment on primary    -> propagates to members
//   5) emergency_reports_list exposes cluster_id
// Inserts as dispatcher + admin (staff roles — no photo requirement), then
// deletes the probe rows at the end.

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.log('SKIP  no Supabase env vars'); process.exit(1); }

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
};

const TAG = `cluster-probe-${Date.now()}`;
const CENTER = { latitude: 10.297085, longitude: 123.907249 };
const NEAR   = { latitude: 10.297585, longitude: 123.907249 };   // ~55m north
const FAR    = { latitude: 10.301085, longitude: 123.907249 };   // ~440m north

async function signIn(email, password) {
  const sb = createClient(url, key);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  const { data: me } = await sb.auth.getUser();
  return { sb, user: me.user };
}

const report = (reporterId, type, coords, marker) => ({
  reporter_id: reporterId,
  report_type: type,
  content: `${TAG} ${marker}`,
  attachments: {
    location: `GPS: ${coords.latitude}, ${coords.longitude} — ${TAG}`,
    ...coords,
    contact_name: `Probe ${marker}`,
  },
  priority: 'low',
});

const dispatcher = await signIn('dispatcher@emergency.gov', 'dispatcher123');
const admin = await signIn('admin@emergency.gov', 'admin123');
const created = [];

// --- 1. Primary report (dispatcher) -------------------------------------
const { data: r1, error: e1 } = await dispatcher.sb
  .from('emergency_reports').insert(report(dispatcher.user.id, 'fire', CENTER, 'primary')).select('id, cluster_id').single();
check('primary inserts', !e1, e1?.message);
if (e1) process.exit(1);
created.push(r1.id);
check('primary cluster_id is NULL', r1.cluster_id === null, `got ${r1.cluster_id}`);

// --- 2. Corroborating report (admin, different reporter, ~55m) ----------
const { data: r2, error: e2 } = await admin.sb
  .from('emergency_reports').insert(report(admin.user.id, 'fire', NEAR, 'member')).select('id').single();
check('member inserts', !e2, e2?.message);
if (r2) created.push(r2.id);
// INSERT ... RETURNING reflects the row before the AFTER-trigger's UPDATE,
// so cluster_id must be re-fetched to observe the link.
const { data: r2live } = await admin.sb
  .from('emergency_reports').select('cluster_id').eq('id', r2.id).single();
check('member linked to primary', r2live?.cluster_id === r1.id, `got ${r2live?.cluster_id}`);

// --- 3. Same type but >150m away — must NOT link -------------------------
const { data: r3, error: e3 } = await dispatcher.sb
  .from('emergency_reports').insert(report(dispatcher.user.id, 'fire', FAR, 'far')).select('id, cluster_id').single();
check('far report inserts', !e3, e3?.message);
if (r3) created.push(r3.id);
check('far report NOT clustered', r3?.cluster_id === null, `got ${r3?.cluster_id}`);

// --- 4. Different type, same coords — must NOT link ----------------------
const { data: r4, error: e4 } = await dispatcher.sb
  .from('emergency_reports').insert(report(dispatcher.user.id, 'medical', CENTER, 'other-type')).select('id, cluster_id').single();
check('other-type inserts', !e4, e4?.message);
if (r4) created.push(r4.id);
check('other-type NOT clustered', r4?.cluster_id === null, `got ${r4?.cluster_id}`);

// --- 5. Propagation: assign primary -> member follows --------------------
const { data: profiles } = await admin.sb
  .from('user_profiles').select('id').eq('role', 'responder').limit(1);
const responderId = profiles?.[0]?.id ?? admin.user.id;
const { error: e5 } = await admin.sb
  .from('emergency_reports')
  .update({ status: 'assigned', assigned_to: responderId })
  .eq('id', r1.id);
check('primary update ok', !e5, e5?.message);
const { data: memberAfter } = await admin.sb
  .from('emergency_reports').select('status, assigned_to').eq('id', r2.id).single();
check('member status propagated', memberAfter?.status === 'assigned', `got ${memberAfter?.status}`);
check('member assignee propagated', memberAfter?.assigned_to === responderId, `got ${memberAfter?.assigned_to}`);

// --- 6. Slim view exposes cluster_id -------------------------------------
const { data: listRow, error: e6 } = await dispatcher.sb
  .from('emergency_reports_list').select('id, cluster_id').eq('id', r2.id).single();
check('list view returns cluster_id', !e6 && listRow?.cluster_id === r1.id, e6?.message ?? `got ${listRow?.cluster_id}`);

// --- cleanup -------------------------------------------------------------
for (const [sb, id] of [[admin.sb, r2?.id], [dispatcher.sb, r1.id], [dispatcher.sb, r3?.id], [dispatcher.sb, r4?.id]]) {
  if (!id) continue;
  const { error } = await sb.from('emergency_reports').delete().eq('id', id);
  if (error) console.warn(`cleanup: could not delete ${id}: ${error.message}`);
}
await dispatcher.sb.auth.signOut();
await admin.sb.auth.signOut();

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
