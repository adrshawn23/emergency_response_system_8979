// notify-suspension — emails a user when an admin suspends their account.
//
// Same contract as notify-decision: authenticated admin caller only, the
// reason is read from the stored user_profiles row — the client cannot
// supply a fake one. Called right after the suspend write.
//
// Deploy: supabase functions deploy notify-suspension
// Secrets: BREVO_API_KEY (or RESEND_API_KEY fallback), EMAIL_FROM —
// without them sendEmail no-ops.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, decisionEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

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

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: me } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => null);
    const targetId = body?.user_id;
    if (!targetId) return json({ error: 'user_id required' }, 400);

    const { data: target, error } = await admin
      .from('user_profiles')
      .select('email, account_status, suspension_reason')
      .eq('id', targetId)
      .single();
    if (error || !target) return json({ error: 'not_found' }, 404);
    if (target.account_status !== 'suspended')
      return json({ skipped: true, reason: 'account not suspended' });
    if (!target.email) return json({ skipped: true, reason: 'no recipient email' });

    const reason = target.suspension_reason ||
      'Your access was suspended by an administrator. Contact the barangay office for details.';

    const result = await sendEmail(
      target.email,
      'Account suspended — Kalubihan Emergency Command',
      decisionEmail('suspended', reason),
    );
    return json(result);
  } catch (e) {
    console.error('notify-suspension unhandled error:', e);
    return json({ error: 'internal_error' }, 500);
  }
});
