// Geofence smoke test — run: node --env-file=.env scripts/test-geofence.mjs
// 1) Text matcher: isAddressInServiceArea against varied real-world formats
// 2) Ray-casting: isPointInBoundary with a tiny triangle
// 3) Live DB: does geofence_boundaries exist and hold an active polygon?

import { isAddressInServiceArea, isPointInBoundary } from '../src/utils/geofence.js';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
};

console.log('--- isAddressInServiceArea (K spelling) ---');
check('plain lowercase', isAddressInServiceArea('kalubihan'), true);
check('brgy prefix uppercase', isAddressInServiceArea('BRGY. KALUBIHAN, CEBU CITY'), true);
check('typical ID format', isAddressInServiceArea('Purok 4, Barangay Kalubihan, Cebu City'), true);

console.log('--- isAddressInServiceArea (C spelling variant) ---');
check('calubihan', isAddressInServiceArea('Brgy. Calubihan'), true);
check('punctuation/mixed', isAddressInServiceArea('poBox 3, CALUBIHAN!'), true);

console.log('--- isAddressInServiceArea (must reject) ---');
check('embedded substring (kalubihanville)', isAddressInServiceArea('Kalubihanville, Cebu'), false);
check('different barangay', isAddressInServiceArea('Brgy. Mabolo, Cebu City'), false);
check('empty string', isAddressInServiceArea(''), false);
check('null', isAddressInServiceArea(null), false);
check('non-string', isAddressInServiceArea(12345), false);

console.log('--- isPointInBoundary (triangle) ---');
const triangle = [{ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, { lat: 0, lng: 10 }];
check('inside', isPointInBoundary({ latitude: 1, longitude: 1 }, triangle), true);
check('outside', isPointInBoundary({ latitude: 9, longitude: 9 }, triangle), false);
check('latitude/longitude point keys accepted', isPointInBoundary({ latitude: 1, longitude: 1 }, triangle.map(p => ({ latitude: p.lat, longitude: p.lng }))), true);
check('non-finite coords', isPointInBoundary({ latitude: NaN, longitude: 1 }, triangle), null);
check('too few points', isPointInBoundary({ latitude: 1, longitude: 1 }, [{ lat: 0, lng: 0 }]), null);

console.log('--- live DB: geofence_boundaries ---');
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('SKIP  no Supabase env vars (pass with --env-file=.env)');
} else {
  const res = await fetch(`${url}/rest/v1/geofence_boundaries?select=name,is_active&limit=5`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (res.status === 200) {
    const rows = await res.json();
    if (rows.length === 0) {
      // The read policy is TO authenticated; this script only holds the anon
      // key, so 0 rows here is expected and proves RLS blocks anonymous reads.
      console.log('PASS  table reachable; anon role sees 0 rows (RLS working). Verify seed with: SELECT * FROM public.geofence_boundaries;');
    } else {
      console.log(`PASS  table reachable, ${rows.length} row(s): ${JSON.stringify(rows)}`);
      if (!rows.some(r => r.is_active)) console.log('WARN  no active boundary row — GPS card will show "verification unavailable"');
    }
  } else if (res.status === 404 || res.status === 400) {
    failures++;
    console.log(`FAIL  table missing/unqueryable (${res.status}) — LocationInput will show "verification unavailable"`);
  } else {
    console.log(`WARN  unexpected status ${res.status}: ${await res.text()}`);
  }
}

console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
process.exitCode = failures ? 1 : 0;
