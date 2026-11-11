// broadcast-incident — resident-wide lifecycle + advisory emails
// (specs/004-emergency-communications, FR-007..010):
//
//   { kind: 'reported',     report_id }       → every active resident: incident
//     card + static map image + evidence photos.
//   { kind: 'resolved',     report_id }       → every active resident: outcome
//     + main resolution photo + every assisting department's resolution_proof
//     labeled by department.
//   { kind: 'announcement', announcement_id, audience? } → advisory to the
//     chosen audience: 'residents' (default), 'staff', or 'everyone'
//     (+ linked-incident map when report_id is set on the announcement).
//
// Auth: 'reported' — the reporter themselves or staff;
//       'resolved' — staff or the assigned responder;
//       'announcement' — admin only.
// Email failures never roll back anything — the caller fires-and-forgets.
//
// Deploy: supabase functions deploy broadcast-incident
// Secrets: BREVO_API_KEY (or RESEND_API_KEY), EMAIL_FROM — shared/email.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import { PNG } from 'https://esm.sh/pngjs@7.0.0';
import { sendEmail, EmailAttachment } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—';

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unit';

const STAFF = ['admin', 'dispatcher', 'department_admin'];
// Advisory email audience ('staff') — every staff role incl. responders;
// separate from STAFF which gates who may call 'resolved'.
const STAFF_ROLES = ['admin', 'dispatcher', 'responder', 'department_admin'];

// The free staticmap providers (staticmap.openstreetmap.de et al.) are
// unreliable — dead DNS/hosts killed email delivery. Link out to the
// incident pin on Google Maps instead; no API key, always reachable.
const mapLinkFor = (lat: unknown, lng: unknown) =>
  (typeof lat === 'number' && typeof lng === 'number')
    ? `https://maps.google.com/?q=${lat},${lng}`
    : null;

const mapLinkHtml = (lat: unknown, lng: unknown) => {
  const url = mapLinkFor(lat, lng);
  return url
    ? ` <a href="${url}" style="color:#2563eb;">View on map</a>`
    : '';
};

// --- Incident map snapshot -------------------------------------------------
// The free staticmap providers are dead, so we render the pin map ourselves:
// fetch the OSM tiles covering a 600x300 viewport centred on the incident,
// blit them into an RGBA canvas, draw a pin, and attach the PNG bytes.
const MAP_W = 600, MAP_H = 300, TILE = 256, MAP_ZOOM = 16;

const mercator = (lat: number, lng: number) => {
  const n = 2 ** MAP_ZOOM;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n * TILE,
    y: (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * TILE,
  };
};

const setPx = (buf: Uint8Array, x: number, y: number, r: number, g: number, b: number) => {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return;
  const i = (MAP_W * y + x) * 4;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
};

// Simple teardrop pin centred on the point: white outline, red head+tail,
// white hole — drawn flat onto the RGBA buffer.
const drawPin = (buf: Uint8Array, cx: number, cy: number) => {
  const R = 11;
  const headY = cy - R - 4; // pin tip sits exactly on the incident point
  for (let y = cy - 34; y <= cy; y++) {
    for (let x = cx - R - 2; x <= cx + R + 2; x++) {
      const dHead = Math.hypot(x - cx, y - headY);
      const tailT = y < headY ? -1 : (y - headY) / (cy - headY);
      const halfW = 4.5 * tailT;
      const inTail = y >= headY && Math.abs(x - cx) <= halfW + 1;
      const inHead = dHead <= R + 1;
      if (inHead || inTail) setPx(buf, x, y, 255, 255, 255);
      if (dHead <= R || (y >= headY && Math.abs(x - cx) <= halfW)) {
        setPx(buf, x, y, 220, 38, 38);
      }
      if (dHead <= 4) setPx(buf, x, y, 255, 255, 255);
    }
  }
};

const incidentMapAttachment = async (lat: unknown, lng: unknown): Promise<EmailAttachment | null> => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  try {
    const { x: px, y: py } = mercator(lat, lng);
    const left = px - MAP_W / 2, top = py - MAP_H / 2;
    const n = 2 ** MAP_ZOOM;
    const canvas = new Uint8Array(MAP_W * MAP_H * 4);
    for (let i = 0; i < canvas.length; i += 4) {
      canvas[i] = 234; canvas[i + 1] = 236; canvas[i + 2] = 239; canvas[i + 3] = 255;
    }

    const tx0 = Math.floor(left / TILE), tx1 = Math.floor((left + MAP_W) / TILE);
    const ty0 = Math.floor(top / TILE), ty1 = Math.floor((top + MAP_H) / TILE);
    const jobs: Promise<void>[] = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (ty < 0 || ty >= n) continue; // nothing north/south of the poles
        const fx = ((tx % n) + n) % n;   // wrap around the antimeridian
        jobs.push((async () => {
          const res = await fetch(`https://tile.openstreetmap.org/${MAP_ZOOM}/${fx}/${ty}.png`, {
            headers: { 'User-Agent': 'KalubihanEmergency/1.0 (incident-alerts)' },
          });
          if (!res.ok) return;
          const tile = PNG.sync.read(Buffer.from(new Uint8Array(await res.arrayBuffer())));
          const offX = tx * TILE - left, offY = ty * TILE - top;
          for (let y = 0; y < tile.height; y++) {
            const dy = Math.floor(offY) + y;
            if (dy < 0 || dy >= MAP_H) continue;
            for (let x = 0; x < tile.width; x++) {
              const dx = Math.floor(offX) + x;
              if (dx < 0 || dx >= MAP_W) continue;
              const si = (tile.width * y + x) * 4, di = (MAP_W * dy + dx) * 4;
              canvas[di] = tile.data[si]; canvas[di + 1] = tile.data[si + 1];
              canvas[di + 2] = tile.data[si + 2]; canvas[di + 3] = tile.data[si + 3];
            }
          }
        })());
      }
    }
    await Promise.all(jobs);

    drawPin(canvas, MAP_W / 2, MAP_H / 2);
    const out = new PNG({ width: MAP_W, height: MAP_H });
    out.data = Buffer.from(canvas);
    const pngBuf: Uint8Array = PNG.sync.write(out);
    let bin = '';
    for (let i = 0; i < pngBuf.length; i += 0x8000) {
      bin += String.fromCharCode(...pngBuf.subarray(i, i + 0x8000));
    }
    return { name: 'incident-map.png', content: btoa(bin) };
  } catch (e) {
    console.warn('incident map render failed:', e instanceof Error ? e.message : e);
    return null; // email still sends, just without the image
  }
};

const dataUrlToAttachment = (src: string, name: string): EmailAttachment | null => {
  const m = src.match(/^data:(image\/[\w+.-]+);base64,([\s\S]+)$/);
  if (!m) return /^https?:\/\//.test(src) ? { name, url: src } : null;
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  return { name: `${name}.${ext}`, content: m[2] };
};

// Evidence photos from the report row (reporter-uploaded images +
// resolution_proof when present).
const reportPhotos = (report: any): EmailAttachment[] => {
  const atts = report?.attachments ?? {};
  const sources: string[] = [
    ...(Array.isArray(atts.images) ? atts.images : []),
    ...(Array.isArray(atts.photos) ? atts.photos : []),
    ...(Array.isArray(atts.evidence) ? atts.evidence : []),
  ].filter(s => typeof s === 'string');
  const out: EmailAttachment[] = [];
  sources.slice(0, 6).forEach((src, i) => {
    const a = dataUrlToAttachment(src, `evidence-${i + 1}.jpg`.replace('.jpg.jpg', '.jpg'));
    if (a) out.push(a);
  });
  if (typeof atts.resolution_proof === 'string') {
    const a = dataUrlToAttachment(atts.resolution_proof, 'resolution-proof.jpg'.replace('.jpg.jpg', '.jpg'));
    if (a) out.push(a);
  }
  return out;
};

const shell = (accent: string, heading: string, sub: string, inner: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(heading)} — Kalubihan Emergency Response</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.08);">
        <tr>
          <td style="background-color:${accent};padding:32px 40px;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.75);">Kalubihan Emergency Response</p>
            <h1 style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#ffffff;">${esc(heading)}</h1>
            ${sub ? `<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:rgba(255,255,255,0.85);">${esc(sub)}</p>` : ''}
          </td>
        </tr>
        <tr><td style="padding:32px 40px;">${inner}</td></tr>
        <tr>
          <td style="padding:20px 40px 28px;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#94a3b8;">
              Kalubihan Emergency Response &middot; Barangay Kalubihan, Cebu City &middot; Automated notice — please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const row = (label: string, value: string) => `
  <tr>
    <td style="padding:7px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#64748b;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:7px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">${value}</td>
  </tr>`;

const detailsTable = (fields: [string, string][]) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    ${fields.map(([l, v]) => row(l, v)).join('')}
  </table>`;

const attachNote = (n: number, what: string) => n > 0 ? `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;">
    <tr><td style="background-color:#eff6ff;border-left:4px solid #2563eb;border-radius:6px;padding:12px 16px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#1e40af;">
        ${n} attachment${n === 1 ? '' : 's'} included — ${what}.
      </p>
    </td></tr>
  </table>` : '';

const reportLocation = (report: any) => {
  const at = report?.attachments ?? {};
  return at.location || [at.latitude, at.longitude].filter(v => typeof v === 'number').join(', ') || 'See incident details';
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const kind = body?.kind;
    if (!['reported', 'resolved', 'announcement'].includes(kind)) return json({ error: 'kind required' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: me } = await admin.from('user_profiles').select('role').eq('id', user.id).single();

    // ---- Resolve payload + authorize -------------------------------------
    let subject = '';
    let html = '';
    const attachments: EmailAttachment[] = [];

    if (kind === 'announcement') {
      if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403);
      const { data: ann } = await admin.from('announcements').select('*').eq('id', body?.announcement_id).single();
      if (!ann) return json({ error: 'not_found' }, 404);

      let linkedMap = '';
      if (ann.report_id) {
        const { data: rep } = await admin.from('emergency_reports').select('attachments').eq('id', ann.report_id).single();
        const mapLink = rep ? mapLinkFor(rep.attachments?.latitude, rep.attachments?.longitude) : null;
        const mapAtt = rep ? await incidentMapAttachment(rep.attachments?.latitude, rep.attachments?.longitude) : null;
        if (mapAtt) attachments.push(mapAtt);
        if (mapLink || mapAtt) {
          linkedMap = `<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;">${mapAtt ? 'An incident map is attached. ' : ''}${mapLink ? `Location: <a href="${mapLink}" style="color:#2563eb;">view on map</a>` : ''}</p>`;
        }
      }
      const sevColor = { info: '#2563eb', warning: '#d97706', critical: '#dc2626' }[ann.severity as string] ?? '#2563eb';
      subject = `[${String(ann.severity).toUpperCase()}] ${ann.title} — Barangay Kalubihan advisory`;
      html = shell(sevColor, 'Emergency advisory', fmt(ann.created_at), `
        <h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#0f172a;">${esc(ann.title)}</h2>
        <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#334155;white-space:pre-wrap;">${esc(ann.body)}</p>
        ${linkedMap}`);
    } else {
      const { data: report, error } = await admin.from('emergency_reports').select('*').eq('id', body?.report_id).single();
      if (error || !report) return json({ error: 'not_found' }, 404);

      const at = report.attachments ?? {};
      const mapAtt = await incidentMapAttachment(at.latitude, at.longitude);
      if (mapAtt) attachments.push(mapAtt);

      if (kind === 'reported') {
        // Reporter may announce their own incident; staff may announce any.
        if (report.reporter_id !== user.id && !STAFF.includes(me?.role)) return json({ error: 'forbidden' }, 403);
        attachments.push(...reportPhotos(report));
        subject = `New incident reported: ${report.report_type ?? 'emergency'} — ${reportLocation(report)}`;
        html = shell('#b91c1c', 'New incident reported', 'See the announcements page for live progress', `
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#334155;">
            An emergency has been reported in Barangay Kalubihan. Response units have been notified.
          </p>
          ${detailsTable([
            ['Incident', esc(`${report.report_type ?? 'incident'} emergency`)],
            ['Location', esc(reportLocation(report)) + mapLinkHtml(at.latitude, at.longitude)],
            ['Priority', esc(report.priority ?? 'standard')],
            ['Reported', fmt(report.created_at)],
          ])}
          ${attachNote(attachments.length, 'incident map and evidence photos')}`);
      } else { // resolved
        if (report.status !== 'resolved') return json({ skipped: true, reason: 'report not resolved' });
        if (!STAFF.includes(me?.role) && report.assigned_to !== user.id) return json({ error: 'forbidden' }, 403);

        // Main resolution photo.
        if (typeof at.resolution_proof === 'string') {
          const a = dataUrlToAttachment(at.resolution_proof, 'resolution-proof');
          if (a) attachments.push(a);
        }
        // Every assisting department's proof photo, labeled by department.
        const { data: units } = await admin
          .from('cross_department_assistance')
          .select('resolution_proof, dept:departments!assisting_department_id(name)')
          .eq('report_id', report.id)
          .not('resolution_proof', 'is', null);
        const unitNames: string[] = [];
        (units ?? []).forEach((u: any, i: number) => {
          const dept = u.dept?.name ?? `assisting-unit-${i + 1}`;
          const a = dataUrlToAttachment(u.resolution_proof, `${slug(dept)}-proof`);
          if (a) { attachments.push(a); unitNames.push(dept); }
        });

        subject = `Incident resolved: ${report.report_type ?? 'emergency'} — ${reportLocation(report)}`;
        html = shell('#047857', 'Incident resolved', 'All units have completed their tasks', `
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#334155;">
            The incident below has been resolved. Thank you for staying informed — full progress remains on the announcements page.
          </p>
          ${detailsTable([
            ['Incident', esc(`${report.report_type ?? 'incident'} emergency`)],
            ['Location', esc(reportLocation(report)) + mapLinkHtml(at.latitude, at.longitude)],
            ['Reported', fmt(report.created_at)],
            ['Resolved', fmt(report.resolved_at || report.updated_at)],
          ])}
          ${unitNames.length ? `<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;">Proof from assisting departments: ${esc(unitNames.join(', '))}.</p>` : ''}
          ${attachNote(attachments.length, 'incident map and resolution proof photos')}`);
      }
    }

    // ---- Recipients -------------------------------------------------------
    // Lifecycle emails always go to residents. Advisories honor the admin's
    // audience choice: 'residents' (default), 'staff', or 'everyone'.
    const audience = kind === 'announcement'
      ? ['residents', 'staff', 'everyone'].includes(body?.audience) ? body.audience : 'residents'
      : 'residents';
    let rq = admin.from('user_profiles').select('email').eq('account_status', 'active');
    if (audience === 'residents') rq = rq.eq('role', 'resident');
    else if (audience === 'staff') rq = rq.in('role', STAFF_ROLES);
    const { data: residents } = await rq;
    const emails = [...new Set((residents ?? []).map((r: any) => r.email).filter(Boolean))];
    if (!emails.length) return json({ sent: 0, skipped: true, reason: 'no resident recipients' });

    let sent = 0;
    let failed = 0;
    for (const to of emails) {
      const res = await sendEmail(to, subject, html, attachments);
      res.sent ? sent++ : failed++;
    }
    return json({ sent, failed, recipients: emails.length });
  } catch (e) {
    console.error('broadcast-incident unhandled error:', e);
    return json({ error: 'internal_error' }, 500);
  }
});
