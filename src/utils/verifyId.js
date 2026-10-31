import { supabase } from '../lib/supabase';
import { fileToDataUrl } from './ocr';

// Client entry point for server-controlled ID verification.
//
// Preferred path: the verify-id edge function does magic-byte validation,
// private-bucket upload, server OCR, and the conservative compare — the
// browser only sends the image and the declared fields.
//
// Fallback path (function not deployed yet): upload the image straight to the
// private id-documents bucket at an unpredictable path and insert a pending
// verification row. RLS + the guard trigger keep this safe: the client can
// only write to its own folder and can never set decision/OCR fields.

const toBase64 = async (file) => {
  const dataUrl = await fileToDataUrl(file);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
};

const extFor = (file) => {
  const t = (file?.type || '').toLowerCase();
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  return 'jpg';
};

// Returns a user-facing note string, or null for the default message.
export const submitIdForVerification = async ({ file, declared, userId }) => {
  // Path A — edge function (server OCR)
  try {
    const { data, error } = await supabase.functions.invoke('verify-id', {
      body: {
        image_base64: await toBase64(file),
        declared: {
          fullName: declared.fullName,
          birthdate: declared.birthdate,
          address: declared.address,
        },
      },
    });

    if (!error && data?.outcome === 'auto_approved') {
      return 'Your ID was verified automatically — your account is now active. You can sign in.';
    }
    if (!error && data?.outcome === 'correction_required') {
      const reasons = (data.reasons || []).join(' ');
      return `Registration received, but the ID needs correction: ${reasons} Sign in and resubmit a clearer or matching ID — your account is not locked.`;
    }
    if (!error && data?.outcome === 'pending_admin') {
      return null; // standard pending message
    }
    if (!error) return null;
    throw error;
  } catch (invokeError) {
    console.warn('verify-id unavailable, using storage fallback:', invokeError?.message || invokeError);
  }

  // Path B — direct private-storage upload + pending row
  try {
    const path = `${userId}/${crypto.randomUUID()}.${extFor(file)}`;
    const { error: uploadError } = await supabase.storage
      .from('id-documents')
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase
      .from('id_verifications')
      .insert({ user_id: userId, id_document_url: path, document_storage_path: path });
    if (insertError) throw insertError;
    return null;
  } catch (fallbackError) {
    console.error('ID submission fallback failed:', fallbackError);
    // Account exists and the bare pending row remains — admin sees it in the
    // review queue and can request the document via needs_clarity.
    return 'Registration received. Your ID could not be uploaded — sign in and submit it from your account page to continue verification.';
  }
};
