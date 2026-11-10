// notify-resolved — emails the reporting resident when their incident is
// marked resolved: full incident summary + appreciation copy + evidence /
// resolution photos attached as real email attachments (data-URL <img>
// doesn't render in Gmail/Outlook, so inline embedding is not an option).
//
// Caller must be authenticated AND either staff (admin / dispatcher /
// department_admin) or the responder assigned to this report — the client
// cannot trigger mail to arbitrary reporters.
//
// Called by the client right after a successful resolve write
// (responder proof-resolve AND dispatcher turnover path).
//
// Deploy: supabase functions deploy notify-resolved
// Secrets: BREVO_API_KEY (or RESEND_API_KEY fallback), EMAIL_FROM —
// without them sendEmail no-ops.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

// Pull every photo out of attachments: resolution_proof + whatever key the
// reporter evidence landed under. Data-URL → base64 content; http(s) → url.
const collectPhotoAttachments = (report: any): EmailAttachment[] => {
  const atts = report?.attachments ?? {};
  const sources: string[] = [
    ...(Array.isArray(atts.images) ? atts.images : []),
    ...(Array.isArray(atts.photos) ? atts.photos : []),
    ...(Array.isArray(atts.evidence) ? atts.evidence : []),
    ...(Array.isArray(report?.images) ? report.images : []),
    ...(atts.resolution_proof ? [atts.resolution_proof] : []),
  ].filter(s => typeof s === 'string');

  const out: EmailAttachment[] = [];
  sources.slice(0, 6).forEach((src, i) => {
    const m = src.match(/^data:(image\/[\w+.-]+);base64,([\s\S]+)$/);
    if (m) {
      const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
      out.push({ name: `${src === atts.resolution_proof ? 'resolution' : 'evidence'}-${i + 1}.${ext}`, content: m[2] });
    } else if (/^https?:\/\//.test(src)) {
      out.push({ name: `photo-${i + 1}.jpg`, url: src });
    }
  });
  return out;
};

const resolvedEmail = (o: {
  reporterName: string; type: string; location: string; priority: string;
  reportedAt: string; resolvedAt: string; deptName: string; responderName: string;
  photoCount: number;
}) => {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:7px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#64748b;width:120px;vertical-align:top;">${label}</td>
      <td style="padding:7px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">${value}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Incident resolved — Kalubihan Emergency Response</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.08);">

          <tr>
            <td style="background-color:#047857;background:linear-gradient(135deg,#047857 0%,#065f46 100%);padding:32px 40px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:50%;width:56px;height:56px;text-align:center;vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:56px;color:#ffffff;">&#10003;</span>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#a7f3d0;">Kalubihan Emergency Response</p>
              <h1 style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#ffffff;">Your report has been resolved</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 40px 8px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#334155;">
                Hi ${esc(o.reporterName) || 'there'},<br/><br/>
                <strong>Thank you for reporting this incident.</strong> Your report helped responders act quickly —
                we're glad to let you know the incident below has been marked <strong style="color:#047857;">resolved</strong>.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                ${row('Incident', esc(o.type))}
                ${row('Location', esc(o.location))}
                ${row('Priority', esc(o.priority))}
                ${row('Reported', fmt(o.reportedAt))}
                ${row('Resolved', fmt(o.resolvedAt))}
                ${row('Handled by', esc(o.deptName))}
                ${row('Responder', esc(o.responderName))}
              </table>

              ${o.photoCount > 0 ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;">
                <tr>
                  <td style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;padding:12px 16px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#065f46;">
                      ${o.photoCount} photo${o.photoCount === 1 ? '' : 's'} attached — evidence and resolution proof from this incident.
                    </p>
                  </td>
                </tr>
              </table>` : ''}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;">
                <tr>
                  <td style="background-color:#f8fafc;border-left:4px solid #059669;border-radius:6px;padding:12px 16px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#475569;">
                      Thank you for helping keep Barangay Kalubihan safe. Prompt reports like yours make the community stronger.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#94a3b8;">
                Kalubihan Emergency Response &middot; Barangay Kalubihan, Cebu City &middot; This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const reportId = body?.report_id;
    if (!reportId) return json({ error: 'report_id required' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: me } = await admin.from('user_profiles').select('role').eq('id', user.id).single();

    const { data: report, error } = await admin
      .from('emergency_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    if (error || !report) return json({ error: 'not_found' }, 404);
    if (report.status !== 'resolved') return json({ skipped: true, reason: 'report not resolved' });

    // Staff roles + the assigned responder can trigger this mail.
    const staffRoles = ['admin', 'dispatcher', 'department_admin'];
    if (!staffRoles.includes(me?.role) && report.assigned_to !== user.id)
      return json({ error: 'forbidden' }, 403);

    const { data: reporter } = await admin
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', report.reporter_id)
      .single();
    if (!reporter?.email) return json({ skipped: true, reason: 'reporter has no email' });

    let deptName = 'Emergency response team';
    if (report.assigned_department_id) {
      const { data: dept } = await admin.from('departments').select('name').eq('id', report.assigned_department_id).single();
      if (dept?.name) deptName = dept.name;
    }

    let responderName = 'Response team';
    if (report.assigned_to) {
      const { data: resp } = await admin.from('user_profiles').select('full_name').eq('id', report.assigned_to).single();
      if (resp?.full_name) responderName = resp.full_name;
    }

    let resolvedAt = report.resolved_at || report.updated_at;
    const { data: hist } = await admin
      .from('incident_status_history')
      .select('created_at')
      .eq('report_id', reportId)
      .eq('to_status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(1);
    if (hist?.[0]?.created_at) resolvedAt = hist[0].created_at;

    const atts = collectPhotoAttachments(report);
    // Every assisting department's own resolution proof, labeled by dept.
    const { data: units } = await admin
      .from('cross_department_assistance')
      .select('resolution_proof, dept:departments!assisting_department_id(name)')
      .eq('report_id', reportId)
      .not('resolution_proof', 'is', null);
    (units ?? []).forEach((u: any, i: number) => {
      const dept = String(u.dept?.name ?? `assisting-unit-${i + 1}`)
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const m = String(u.resolution_proof).match(/^data:(image\/[\w+.-]+);base64,([\s\S]+)$/);
      if (m) atts.push({ name: `${dept}-proof.${m[1].split('/')[1].replace('jpeg', 'jpg')}`, content: m[2] });
      else if (/^https?:\/\//.test(u.resolution_proof)) atts.push({ name: `${dept}-proof.jpg`, url: u.resolution_proof });
    });
    const at = report.attachments ?? {};
    const location = at.location || [at.latitude, at.longitude].filter(Boolean).join(', ') || 'See report';

    const result = await sendEmail(
      reporter.email,
      'Incident resolved — thank you for reporting',
      resolvedEmail({
        reporterName: reporter.full_name,
        type: `${report.report_type ?? 'incident'} emergency`,
        location,
        priority: report.priority ?? 'standard',
        reportedAt: report.created_at,
        resolvedAt,
        deptName,
        responderName,
        photoCount: atts.length,
      }),
      atts,
    );
    return json(result);
  } catch (e) {
    console.error('notify-resolved unhandled error:', e);
    return json({ error: 'internal_error' }, 500);
  }
});
