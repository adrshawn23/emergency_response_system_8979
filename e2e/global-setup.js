import { client, signInWithRetry } from './helpers.js';

/**
 * Global suite setup — restores canonical page_permissions rows.
 *
 * The live table drifts between runs (access-control edits, manual changes,
 * earlier suites leaving partial writes). A wrong row silently bounces
 * role-based navigation (e.g. 'new' losing dispatcher/responder breaks
 * geofence + composer specs; 'queue' losing responder hides their nav).
 * Restoring the code defaults from DEFAULT_PAGE_ROLES once per run keeps
 * every spec on the same footing. Failure is logged, not thrown — a
 * permissions outage is better surfaced by the specs themselves.
 */
const CANONICAL = {
  command: ['admin', 'dispatcher', 'responder', 'resident', 'department_admin'],
  queue: ['admin', 'dispatcher', 'responder', 'department_admin'],
  new: ['admin', 'dispatcher', 'responder', 'resident'],
  residents: ['admin'],
  access: ['admin'],
  departments: ['admin'],
  reports: ['admin', 'dispatcher'],
  profile: ['admin', 'dispatcher', 'responder', 'resident', 'department_admin'],
  settings: ['admin'],
};

export default async function globalSetup() {
  const sb = client();
  try {
    await signInWithRetry(sb, 'admin@emergency.gov', 'admin123');
    const rows = Object.entries(CANONICAL).map(([page_key, allowed_roles]) => ({
      page_key,
      allowed_roles,
    }));
    const { error } = await sb
      .from('page_permissions')
      .upsert(rows, { onConflict: 'page_key' });
    if (error) {
      console.warn(`global-setup: page_permissions restore failed: ${error.message}`);
    }
  } catch (err) {
    console.warn(`global-setup: ${err?.message || err}`);
  } finally {
    await sb.auth.signOut();
  }
}
