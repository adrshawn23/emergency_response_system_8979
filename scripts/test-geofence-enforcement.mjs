// Geofence enforcement test — run: node --env-file=.env scripts/test-geofence-enforcement.mjs
// Verifies 20261116103000_geofence_enforcement.sql live:
//   1) resident + coords OUTSIDE boundary -> insert REJECTED (check_violation)
//   2) resident + coords INSIDE boundary  -> insert succeeds (then deleted)
//   3) dispatcher + OUTSIDE coords        -> succeeds (staff bypass, deleted)
// Needs a live resident account: resident@example.com / resident123.

import { createClient } from '@supabase/supabase-js';
import { isPointInBoundary } from '../src/utils/geofence.js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.log('SKIP  no Supabase env vars'); process.exit(1); }

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
};

const IMG = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='];
const TAG = `geofence-probe-${Date.now()}`;

const report = (reporterId, coords, marker) => ({
  reporter_id: reporterId,
  report_type: 'fire',
  content: `${TAG} ${marker}`,
  attachments: {
    location: `GPS: ${coords.latitude}, ${coords.longitude} — ${TAG}`,
    ...coords,
    contact_name: `Probe ${marker}`,
    images: IMG,
  },
  priority: 'low',
});

async function signIn(email, password) {
  const sb = createClient(url, key);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  const { data: me } = await sb.auth.getUser();
  return { sb, user: me.user };
}

// --- derive INSIDE/OUTSIDE points from the live boundary --------------------
// The admin-drawn polygon isn't centered on the seed coords, so read it and
// verify with the app's own ray-cast — this test adapts to whatever boundary
// is active at run time.
const probe = createClient(url, key);
await probe.auth.signInWithPassword({ email: 'dispatcher@emergency.gov', password: 'dispatcher123' });
const { data: boundary } = await probe
  .from('geofence_boundaries').select('points').eq('is_active', true).maybeSingle();
if (!boundary?.points?.length) { console.log('FAIL  no active geofence_boundaries row'); process.exit(1); }
const pts = boundary.points;
const centroid = pts.reduce(
  (a, p) => ({ lat: a.lat + (p.lat ?? p.latitude) / pts.length, lng: a.lng + (p.lng ?? p.longitude) / pts.length }),
  { lat: 0, lng: 0 });
const inside = isPointInBoundary({ latitude: centroid.lat, longitude: centroid.lng }, pts);
// Centroid can fall outside a concave polygon — nudge toward the first vertex
// until the app's own check agrees it's inside.
let INSIDE = inside
  ? { latitude: centroid.lat, longitude: centroid.lng }
  : null;
for (let t = 0.1; !INSIDE && t < 1; t += 0.1) {
  const cand = {
    latitude: centroid.lat + ((pts[0].lat ?? pts[0].latitude) - centroid.lat) * t,
    longitude: centroid.lng + ((pts[0].lng ?? pts[0].longitude) - centroid.lng) * t,
  };
  if (isPointInBoundary(cand, pts)) INSIDE = cand;
}
if (!INSIDE) { console.log('FAIL  could not derive an interior point'); process.exit(1); }
const OUTSIDE = { latitude: INSIDE.latitude + 0.02, longitude: INSIDE.longitude + 0.02 };
console.log(`boundary: ${pts.length} pts | inside probe ${INSIDE.latitude.toFixed(5)},${INSIDE.longitude.toFixed(5)}`);

// --- resident: outside must be REJECTED -----------------------------------
const resident = await signIn('resident@example.com', 'resident123');
const { error: eOut } = await resident.sb
  .from('emergency_reports').insert(report(resident.user.id, OUTSIDE, 'outside'));
check('resident outside-boundary insert REJECTED',
  !!eOut && /outside the Barangay Kalubihan/i.test(eOut.message),
  eOut ? eOut.message : 'inserted (should not have)');

// --- resident: inside must succeed -----------------------------------------
const { data: rIn, error: eIn } = await resident.sb
  .from('emergency_reports').insert(report(resident.user.id, INSIDE, 'inside')).select('id').single();
check('resident inside-boundary insert allowed', !eIn, eIn?.message);
if (rIn) await resident.sb.from('emergency_reports').delete().eq('id', rIn.id);
await resident.sb.auth.signOut();

// --- staff (dispatcher): outside still allowed -----------------------------
const staff = await signIn('dispatcher@emergency.gov', 'dispatcher123');
const { data: rStaff, error: eStaff } = await staff.sb
  .from('emergency_reports').insert(report(staff.user.id, OUTSIDE, 'staff')).select('id').single();
check('staff outside-boundary insert allowed (bypass)', !eStaff, eStaff?.message);
if (rStaff) await staff.sb.from('emergency_reports').delete().eq('id', rStaff.id);
await staff.sb.auth.signOut();

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
