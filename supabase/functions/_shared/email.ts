// Minimal transactional email helper for edge functions.
//
// Provider: Resend (https://resend.com). Active only when the secrets are
// configured — otherwise every call is a logged no-op so callers never fail:
//
//   supabase secrets set RESEND_API_KEY=re_xxxx
//   supabase secrets set EMAIL_FROM="Kalubihan Emergency Command <noreply@yourdomain.com>"
//
// Swap providers by replacing the fetch below; keep the sendEmail contract.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> => {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'Kalubihan Emergency Command <onboarding@resend.dev>';

  if (!apiKey) {
    console.log(`sendEmail skipped (RESEND_API_KEY unset) → ${to} :: ${subject}`);
    return { sent: false, skipped: true };
  }
  if (!to) return { sent: false, error: 'missing_recipient' };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`sendEmail provider error ${res.status}: ${detail}`);
      return { sent: false, error: `provider_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('sendEmail failed:', e);
    return { sent: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
};

// Shared branded-ish layout for decision notices. Text-only friendly.
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

  const cta = {
    approved: 'You can now sign in to Kalubihan Emergency Command.',
    pending: 'You will receive another email once a decision is made — usually within 24 hours.',
    rejected: 'Sign in to your account to resubmit a clearer or corrected ID, or contact the barangay office if you believe this was a mistake.',
    correction_required: 'Sign in to your account to resubmit a clearer or corrected ID, or contact the barangay office if you believe this was a mistake.',
  }[status];

  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:${color};margin:0 0 12px">${heading}</h2>
      <p style="color:#334155;line-height:1.6;margin:0 0 8px">${reason}</p>
      <p style="color:#334155;line-height:1.6">${cta}</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Kalubihan Emergency Command — automated notice, do not reply.</p>
    </div>`;
};
