// Minimal transactional email helper for edge functions.
//
// Providers (auto-detected from secrets, in priority order):
//   Brevo  — BREVO_API_KEY   (free 300/day, single-sender verify, NO domain needed)
//   Resend — RESEND_API_KEY  (needs verified domain for real recipients)
// When neither is set every call is a logged no-op so callers never fail:
//
//   supabase secrets set BREVO_API_KEY=xkeysib-xxxx
//   supabase secrets set EMAIL_FROM="Kalubihan Emergency Command <kalubihan.brgy@gmail.com>"
//
// EMAIL_FROM accepts "Name <addr>" or a bare address; the sender address must
// be the one verified in Brevo (Senders → Add sender → confirm link).

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const parseFrom = (from: string): { name?: string; email: string } => {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || undefined, email: m[2] } : { email: from };
};

// A photo/file to attach. `content` is base64 (no data-URL prefix);
// `url` lets providers pull a remote file. Providers don't render inline
// data-URI <img> — real attachments are the reliable path.
export interface EmailAttachment {
  name: string;
  content?: string; // base64
  url?: string;
}

const sendViaBrevo = async (
  apiKey: string, from: string, to: string, subject: string, html: string,
  attachments?: EmailAttachment[],
): Promise<Response> => {
  const sender = parseFrom(from);
  const attachment = attachments?.length
    ? attachments.map(a => (a.url ? { name: a.name, url: a.url } : { name: a.name, content: a.content }))
    : undefined;
  return fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, ...(attachment && { attachment }) }),
  });
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> => {
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'Kalubihan Emergency Command <onboarding@resend.dev>';

  if (!brevoKey && !resendKey) {
    console.log(`sendEmail skipped (BREVO_API_KEY/RESEND_API_KEY unset) → ${to} :: ${subject}`);
    return { sent: false, skipped: true };
  }
  if (!to) return { sent: false, error: 'missing_recipient' };

  try {
    const res = brevoKey
      ? await sendViaBrevo(brevoKey, from, to, subject, html, attachments)
      : await fetch(RESEND_ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: [to], subject, html,
            ...(attachments?.length && {
              attachments: attachments.map(a =>
                a.url ? { filename: a.name, path: a.url } : { filename: a.name, content: a.content }),
            }),
          }),
        });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`sendEmail ${brevoKey ? 'brevo' : 'resend'} error ${res.status}: ${detail}`);
      return { sent: false, error: `provider_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('sendEmail failed:', e);
    return { sent: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
};

// Branded card layout for decision notices — matches the Confirm-signup
// template in supabase/email_templates/confirm_signup.html.
export const decisionEmail = (
  status: 'approved' | 'rejected' | 'correction_required' | 'pending',
  reason: string,
) => {
  const heading = {
    approved: 'Your account has been approved',
    rejected: 'Your registration was not approved',
    correction_required: 'Your ID needs correction',
    pending: 'Your ID is under review',
  }[status];
  const color = { approved: '#059669', rejected: '#dc2626', correction_required: '#d97706', pending: '#2563eb' }[status];
  const tint = { approved: '#ecfdf5', rejected: '#fef2f2', correction_required: '#fffbeb', pending: '#eff6ff' }[status];
  const icon = { approved: '&#10003;', rejected: '&#10007;', correction_required: '&#9998;', pending: '&#9200;' }[status];

  const cta = {
    approved: 'You can now sign in to Kalubihan Emergency Response.',
    pending: 'You will receive another email once a decision is made — usually within 24 hours.',
    rejected: 'If you believe this was a mistake, contact the barangay office to appeal.',
    correction_required: 'Fix the issue above, then submit a corrected or clearer ID photo.',
    suspended: 'If you believe this was a mistake, contact the barangay office to appeal.',
  }[status];

  // Numbered guide shown when the user must act — mirrors the resident-home flow.
  const steps = {
    approved: null,
    pending: null,
    suspended: null,
    rejected: [
      'Sign in with the email and password you registered.',
      'Open your Resident Home — the verification card shows what went wrong.',
      'Upload a different valid ID, or a clearer photo of the same one.',
      'Tap "Submit ID for verification" — you\'ll get an email with the new result.',
    ],
    correction_required: [
      'Sign in with the email and password you registered.',
      'Open your Resident Home — the verification card shows what went wrong.',
      'Upload a corrected or clearer photo of your ID.',
      'Tap "Submit ID for verification" — you\'ll get an email with the new result.',
    ],
  }[status];

  const stepsHtml = steps
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;">
        <tr>
          <td>
            <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0f172a;">What to do next</p>
            ${steps.map((s, i) => `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;">
              <tr>
                <td width="28" valign="top" style="background-color:${color};border-radius:50%;width:24px;height:24px;text-align:center;vertical-align:middle;">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:24px;color:#ffffff;">${i + 1}</span>
                </td>
                <td style="padding-left:12px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:24px;color:#334155;">${s}</p>
                </td>
              </tr>
            </table>`).join('')}
          </td>
        </tr>
      </table>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${heading} — Kalubihan Emergency Response</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.08);">

          <!-- Header band -->
          <tr>
            <td style="background-color:#b91c1c;background:linear-gradient(135deg,#b91c1c 0%,#7f1d1d 100%);padding:32px 40px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:50%;width:56px;height:56px;text-align:center;vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:56px;color:#ffffff;">${icon}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#fecaca;">Kalubihan Emergency Response</p>
              <h1 style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#ffffff;">${heading}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background-color:${tint};border:2px dashed ${color};border-radius:10px;padding:22px 20px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#0f172a;">${reason}</p>
                  </td>
                </tr>
              </table>
              ${stepsHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;">
                <tr>
                  <td style="background-color:#f8fafc;border-left:4px solid ${color};border-radius:6px;padding:12px 16px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#475569;">${cta}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #e2e8f0;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#64748b;">
                If you didn't create an account, you can safely ignore this email.
              </p>
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
